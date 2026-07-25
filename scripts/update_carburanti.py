#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
update_carburanti.py
=====================

Scopo
-----
Questo script viene eseguito ogni giorno da una GitHub Action (vedi
.github/workflows/update-carburanti.yml). Scarica i due dataset "open data"
pubblicati dal MIMIT:

  1) Anagrafica degli impianti attivi (chi è, dove si trova ogni distributore)
     https://www.mimit.gov.it/images/exportCSV/anagrafica_impianti_attivi.csv

  2) Prezzo alle 8 di mattina (prezzo praticato da ogni impianto, per carburante)
     https://www.mimit.gov.it/images/exportCSV/prezzo_alle_8.csv

Li unisce tramite l'idImpianto e produce dei file JSON statici dentro
utility/data/carburanti/, che la pagina carburanti.html legge direttamente
via fetch(). In questo modo il browser dell'utente non deve mai contattare
il sito del MIMIT (che non espone header CORS e bloccherebbe la richiesta),
ma scarica solo file JSON dallo stesso dominio (GitHub Pages) su cui gira
la pagina.

Perché conviene fare così invece di leggere il CSV "al volo" nel browser:
- niente problemi di CORS;
- i CSV del MIMIT sono grezzi, con righe malformate qua e là: meglio
  ripulirli una volta al giorno lato server che ad ogni visita;
- i JSON prodotti sono divisi per regione, quindi la pagina scarica solo
  i dati della zona che interessa invece di ~22.000 distributori in un
  colpo solo.

Output prodotto (dentro OUTPUT_DIR)
------------------------------------
  manifest.json          -> data ultimo aggiornamento, elenco regioni/province
  stazioni-geo.json       -> versione "leggera" di tutti i distributori
                             (id, comune, provincia, regione, lat, lon)
                             usata per la ricerca "vicino a me"
  prezzi/<REGIONE>.json  -> per ogni regione, elenco completo dei
                             distributori con anagrafica + prezzi attuali

Formato dei CSV di origine (dal 10 febbraio 2026 il separatore è "|")
----------------------------------------------------------------------
anagrafica_impianti_attivi.csv:
  riga 1: "Estrazione del AAAA-MM-GG"  (va scartata)
  riga 2 (header): idImpianto|Gestore|Bandiera|Tipo Impianto|Nome Impianto|
                   Indirizzo|Comune|Provincia|Latitudine|Longitudine

prezzo_alle_8.csv:
  riga 1: "Estrazione del AAAA-MM-GG"  (va scartata)
  riga 2 (header): idImpianto|descCarburante|prezzo|isSelf|dtComu

Nota: questi CSV storicamente contengono qualche riga "sporca" (campi in
più o virgole/pipe dentro un indirizzo non quotato). Il parsing qui sotto
è quindi difensivo: le righe che non si possono interpretare vengono
scartate e contate, non fanno fallire l'intero aggiornamento.
"""

import csv
import io
import json
import sys
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# Configurazione
# ---------------------------------------------------------------------------

URL_ANAGRAFICA = "https://www.mimit.gov.it/images/exportCSV/anagrafica_impianti_attivi.csv"
URL_PREZZI = "https://www.mimit.gov.it/images/exportCSV/prezzo_alle_8.csv"

# Cartella di output relativa alla root del repository.
# Se nel tuo repo il toolbox vive in un percorso diverso da "utility/",
# aggiorna questa riga (e il fetch() dentro carburanti.js).
OUTPUT_DIR = Path("utility/data/carburanti")

# Un finto User-Agent da browser: alcuni siti della PA rispondono 403
# alle richieste con lo User-Agent di default di urllib/python-requests.
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    )
}

# Mappa sigla provincia -> nome regione. Serve perché il CSV del MIMIT
# indica solo la provincia (es. "BO"), non la regione: senza questa mappa
# non potremmo dividere i dati per regione né mostrare "Emilia-Romagna"
# nei filtri di ricerca.
PROVINCIA_TO_REGIONE = {
    # Abruzzo
    "AQ": "Abruzzo", "CH": "Abruzzo", "PE": "Abruzzo", "TE": "Abruzzo",
    # Basilicata
    "MT": "Basilicata", "PZ": "Basilicata",
    # Calabria
    "CZ": "Calabria", "CS": "Calabria", "KR": "Calabria", "RC": "Calabria", "VV": "Calabria",
    # Campania
    "AV": "Campania", "BN": "Campania", "CE": "Campania", "NA": "Campania", "SA": "Campania",
    # Emilia-Romagna
    "BO": "Emilia-Romagna", "FC": "Emilia-Romagna", "FE": "Emilia-Romagna",
    "MO": "Emilia-Romagna", "PC": "Emilia-Romagna", "PR": "Emilia-Romagna",
    "RA": "Emilia-Romagna", "RE": "Emilia-Romagna", "RN": "Emilia-Romagna",
    # Friuli-Venezia Giulia
    "GO": "Friuli-Venezia Giulia", "PN": "Friuli-Venezia Giulia",
    "TS": "Friuli-Venezia Giulia", "UD": "Friuli-Venezia Giulia",
    # Lazio
    "FR": "Lazio", "LT": "Lazio", "RI": "Lazio", "RM": "Lazio", "VT": "Lazio",
    # Liguria
    "GE": "Liguria", "IM": "Liguria", "SP": "Liguria", "SV": "Liguria",
    # Lombardia
    "BG": "Lombardia", "BS": "Lombardia", "CO": "Lombardia", "CR": "Lombardia",
    "LC": "Lombardia", "LO": "Lombardia", "MN": "Lombardia", "MB": "Lombardia",
    "MI": "Lombardia", "PV": "Lombardia", "SO": "Lombardia", "VA": "Lombardia",
    # Marche
    "AN": "Marche", "AP": "Marche", "FM": "Marche", "MC": "Marche", "PU": "Marche",
    # Molise
    "CB": "Molise", "IS": "Molise",
    # Piemonte
    "AL": "Piemonte", "AT": "Piemonte", "BI": "Piemonte", "CN": "Piemonte",
    "NO": "Piemonte", "TO": "Piemonte", "VB": "Piemonte", "VC": "Piemonte",
    # Puglia
    "BA": "Puglia", "BR": "Puglia", "BT": "Puglia", "FG": "Puglia",
    "LE": "Puglia", "TA": "Puglia",
    # Sardegna
    "CA": "Sardegna", "NU": "Sardegna", "OR": "Sardegna", "SS": "Sardegna", "SU": "Sardegna",
    # Sicilia
    "AG": "Sicilia", "CL": "Sicilia", "CT": "Sicilia", "EN": "Sicilia",
    "ME": "Sicilia", "PA": "Sicilia", "RG": "Sicilia", "SR": "Sicilia", "TP": "Sicilia",
    # Toscana
    "AR": "Toscana", "FI": "Toscana", "GR": "Toscana", "LI": "Toscana",
    "LU": "Toscana", "MS": "Toscana", "PI": "Toscana", "PO": "Toscana",
    "PT": "Toscana", "SI": "Toscana",
    # Trentino-Alto Adige
    "BZ": "Trentino-Alto Adige", "TN": "Trentino-Alto Adige",
    # Umbria
    "PG": "Umbria", "TR": "Umbria",
    # Valle d'Aosta
    "AO": "Valle d'Aosta",
    # Veneto
    "BL": "Veneto", "PD": "Veneto", "RO": "Veneto", "TV": "Veneto",
    "VE": "Veneto", "VI": "Veneto", "VR": "Veneto",
}

# Nomi leggibili dei carburanti così come compaiono nel CSV "descCarburante".
# Li teniamo come sono (il MIMIT usa già nomi leggibili tipo "Benzina",
# "Gasolio", "GPL", "Metano", "Benzina Premium", "Gasolio Premium", "L-GNC", "GNL"),
# non serve rimappare, ma il set ci serve per validare/loggare eventuali novità.
CARBURANTI_NOTI = {
    "Benzina", "Gasolio", "GPL", "Metano", "Benzina Premium",
    "Gasolio Premium", "L-GNC", "GNL",
}


# ---------------------------------------------------------------------------
# Funzioni di supporto
# ---------------------------------------------------------------------------

def scarica_csv(url: str) -> list[str]:
    """Scarica un CSV dal MIMIT e lo restituisce come lista di righe di testo.

    Prova prima con encoding UTF-8, poi con ISO-8859-1 (i CSV della PA
    italiana a volte usano la Latin-1 invece dell'UTF-8).
    """
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=60) as resp:
        raw_bytes = resp.read()

    for encoding in ("utf-8", "iso-8859-1"):
        try:
            testo = raw_bytes.decode(encoding)
            return testo.splitlines()
        except UnicodeDecodeError:
            continue

    # Ultima spiaggia: decodifica "tollerante" ignorando i byte non validi,
    # piuttosto che far fallire l'intero aggiornamento per un carattere
    # illeggibile in un indirizzo.
    return raw_bytes.decode("utf-8", errors="replace").splitlines()


def leggi_righe_pipe(righe: list[str], n_colonne_attese: int) -> list[list[str]]:
    """Fa il parsing di righe CSV separate da "|", scartando la prima riga
    (che contiene solo "Estrazione del ...") e le righe malformate.

    Restituisce la lista dei campi di ogni riga valida (header escluso).
    """
    if not righe:
        return []

    # La prima riga ("Estrazione del AAAA-MM-GG") e la seconda (header)
    # vanno scartate: partiamo dalla terza riga in poi.
    corpo = righe[2:] if len(righe) > 2 else []

    reader = csv.reader(corpo, delimiter="|")
    righe_valide = []
    scartate = 0
    for campi in reader:
        if len(campi) == n_colonne_attese:
            righe_valide.append([c.strip() for c in campi])
        else:
            scartate += 1

    if scartate:
        print(f"  attenzione: {scartate} righe scartate perché malformate", file=sys.stderr)

    return righe_valide


def to_float_prezzo(valore: str):
    """Converte il prezzo (che nel CSV usa la virgola come separatore
    decimale, es. "1,789") in un float Python. Restituisce None se il
    valore non è un numero valido.
    """
    try:
        return round(float(valore.replace(",", ".")), 3)
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# Logica principale
# ---------------------------------------------------------------------------

def main() -> None:
    oggi = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    print(f"Aggiornamento prezzi carburanti - {oggi}")

    # --- 1) Anagrafica impianti ------------------------------------------------
    print("Scarico anagrafica impianti...")
    righe_anagrafica = scarica_csv(URL_ANAGRAFICA)
    dati_anagrafica = leggi_righe_pipe(righe_anagrafica, n_colonne_attese=10)
    print(f"  {len(dati_anagrafica)} impianti letti")

    impianti = {}
    province_viste = set()
    for campi in dati_anagrafica:
        (id_impianto, gestore, bandiera, tipo_impianto, nome_impianto,
         indirizzo, comune, provincia, lat, lon) = campi

        try:
            lat_f = float(lat)
            lon_f = float(lon)
        except ValueError:
            # Senza coordinate valide l'impianto non è utilizzabile per la
            # ricerca "vicino a me", ma lo teniamo comunque per la ricerca
            # per comune/provincia (mettiamo lat/lon a None).
            lat_f = None
            lon_f = None

        regione = PROVINCIA_TO_REGIONE.get(provincia.upper(), "Altro")
        province_viste.add((provincia.upper(), regione))

        impianti[id_impianto] = {
            "id": id_impianto,
            "gestore": gestore,
            "bandiera": bandiera or "Non specificata",
            "tipo": tipo_impianto,
            "nome": nome_impianto,
            "indirizzo": indirizzo,
            "comune": comune,
            "provincia": provincia.upper(),
            "regione": regione,
            "lat": lat_f,
            "lon": lon_f,
            "prezzi": [],  # riempito nel passo successivo
        }

    # --- 2) Prezzi praticati -----------------------------------------------------
    print("Scarico prezzi praticati...")
    righe_prezzi = scarica_csv(URL_PREZZI)
    dati_prezzi = leggi_righe_pipe(righe_prezzi, n_colonne_attese=5)
    print(f"  {len(dati_prezzi)} prezzi letti")

    prezzi_senza_impianto = 0
    for campi in dati_prezzi:
        id_impianto, desc_carburante, prezzo, is_self, dt_comunicazione = campi

        if id_impianto not in impianti:
            # Prezzo riferito a un impianto non presente in anagrafica
            # (es. impianto nel frattempo disattivato): lo ignoriamo.
            prezzi_senza_impianto += 1
            continue

        prezzo_f = to_float_prezzo(prezzo)
        if prezzo_f is None:
            continue

        impianti[id_impianto]["prezzi"].append({
            "carburante": desc_carburante,
            "prezzo": prezzo_f,
            # isSelf nel CSV vale "1" per self-service, "0" per servito
            "self": is_self.strip() == "1",
            "comunicato": dt_comunicazione,
        })

    if prezzi_senza_impianto:
        print(f"  {prezzi_senza_impianto} prezzi ignorati (impianto non trovato in anagrafica)")

    # Teniamo solo gli impianti che hanno almeno un prezzo comunicato:
    # un impianto senza prezzi non è utile in una ricerca sui prezzi.
    impianti_con_prezzo = {k: v for k, v in impianti.items() if v["prezzi"]}
    print(f"Impianti con almeno un prezzo: {len(impianti_con_prezzo)}")

    # --- 3) Calcolo medie regionali per carburante -------------------------------
    # Usate dal frontend per mostrare "+0,03 € sopra la media regionale" ecc.
    somma_per_regione_carburante = defaultdict(float)
    conteggio_per_regione_carburante = defaultdict(int)
    for impianto in impianti_con_prezzo.values():
        for p in impianto["prezzi"]:
            chiave = (impianto["regione"], p["carburante"])
            somma_per_regione_carburante[chiave] += p["prezzo"]
            conteggio_per_regione_carburante[chiave] += 1

    medie_regionali = defaultdict(dict)
    for (regione, carburante), somma in somma_per_regione_carburante.items():
        n = conteggio_per_regione_carburante[(regione, carburante)]
        medie_regionali[regione][carburante] = round(somma / n, 3)

    # --- 4) Scrittura file di output ---------------------------------------------
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    prezzi_dir = OUTPUT_DIR / "prezzi"
    prezzi_dir.mkdir(parents=True, exist_ok=True)

    # Raggruppa gli impianti per regione, un file JSON per regione.
    per_regione = defaultdict(list)
    for impianto in impianti_con_prezzo.values():
        per_regione[impianto["regione"]].append(impianto)

    for regione, lista_impianti in per_regione.items():
        nome_file = _slug(regione) + ".json"
        payload = {
            "regione": regione,
            "aggiornato": oggi,
            "mediaRegionale": medie_regionali.get(regione, {}),
            "impianti": lista_impianti,
        }
        with open(prezzi_dir / nome_file, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
        print(f"  scritto prezzi/{nome_file} ({len(lista_impianti)} impianti)")

    # File "leggero" con solo id/posizione/comune, usato per "vicino a me"
    # senza dover scaricare tutte le regioni.
    stazioni_geo = [
        {
            "id": imp["id"],
            "comune": imp["comune"],
            "provincia": imp["provincia"],
            "regione": imp["regione"],
            "lat": imp["lat"],
            "lon": imp["lon"],
        }
        for imp in impianti_con_prezzo.values()
        if imp["lat"] is not None and imp["lon"] is not None
    ]
    with open(OUTPUT_DIR / "stazioni-geo.json", "w", encoding="utf-8") as f:
        json.dump(stazioni_geo, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  scritto stazioni-geo.json ({len(stazioni_geo)} impianti geolocalizzati)")

    # Manifest: elenco regioni/province disponibili, per popolare i filtri
    # senza dover scaricare tutti i dati regione per regione.
    province_ordinate = sorted(province_viste, key=lambda x: x[0])
    manifest = {
        "aggiornato": oggi,
        "fonte": "MIMIT - Osservatorio Prezzi Carburanti",
        "totaleImpianti": len(impianti_con_prezzo),
        "regioni": sorted({r for _, r in province_viste}),
        "province": [{"sigla": sigla, "regione": reg} for sigla, reg in province_ordinate],
        "fileRegioni": {r: _slug(r) + ".json" for r in per_regione.keys()},
    }
    with open(OUTPUT_DIR / "manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print("  scritto manifest.json")

    print("Aggiornamento completato.")


def _slug(nome_regione: str) -> str:
    """Trasforma 'Emilia-Romagna' in 'emilia-romagna', "Valle d'Aosta" in
    'valle-d-aosta', ecc. Usato per i nomi dei file JSON per regione."""
    s = nome_regione.lower()
    s = s.replace("'", "-").replace(" ", "-")
    return s


if __name__ == "__main__":
    main()
