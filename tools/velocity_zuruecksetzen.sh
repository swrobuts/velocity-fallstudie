#!/usr/bin/env bash
# =====================================================================
# Das Schema velocity auf einen Abzug zuruecksetzen
#
# WOFUER
#
# Die Fallstudie ist eine Versuchsplattform: Ein Agent darf ueber die
# api_-Funktionen alles, was auch ein Mensch darf - Raeder ausmustern,
# Kunden sperren, Kunden anonymisieren. Das ist Absicht, denn genau
# daran laesst sich zeigen, was mit einem Agenten in einem
# Warenwirtschaftssystem moeglich wird. Ohne einen Weg zurueck waere
# jeder Versuch endgueltig.
#
# WIE ZURUECKGESETZT WIRD
#
# pg_restore mit --clean --if-exists --single-transaction. Damit haengt
# alles an EINER Transaktion: Entweder steht am Ende der Abzug, oder es
# aendert sich nichts. Ein "drop schema velocity" vorweg waere der
# naheliegendere Weg und der schlechtere - schlaegt die Rueckspielung
# danach fehl, ist das Schema weg und die Anwendung tot.
#
# Nachgemessen am 04.09.2026 in einer Wegwerfdatenbank: 200 von Hand
# anonymisierte Kunden, eine geleerte Prognoseliste und eine geloeschte
# Sicht waren danach wieder da, die 25 RLS-Regeln unveraendert.
#
# WAS NICHT ZURUECKGESETZT WIRD
#
# Das Schema auth. Anmeldungen, Passwoerter und Sitzungen liegen dort
# und bleiben unberuehrt - niemand wird durch ein Zuruecksetzen
# ausgesperrt. Umgekehrt heisst das: Ein Konto, das nach dem Abzug
# angelegt wurde, findet in velocity.kunde keinen Satz mehr vor.
#
# Aufruf:
#   bash tools/velocity_zuruecksetzen.sh              auf den Ausgangsstand
#   bash tools/velocity_zuruecksetzen.sh <datei>      auf einen bestimmten Abzug
#   bash tools/velocity_zuruecksetzen.sh --ja         ohne Rueckfrage
# =====================================================================
set -euo pipefail

HOST=${VELO_HOST:-bot.butscher.cloud}
BEHAELTER=${VELO_DB_BEHAELTER:-supabase-db}
ABLAGE=${VELO_SICHERUNG:-/opt/velocity-sicherung}
DATENBANK=${VELO_DB:-postgres}

ABZUG="velocity_ausgangsstand.dump"
OHNE_RUECKFRAGE=0
for arg in "$@"; do
  case "$arg" in
    --ja) OHNE_RUECKFRAGE=1 ;;
    -*)   echo "Unbekannte Angabe: $arg" >&2; exit 2 ;;
    *)    ABZUG="$arg" ;;
  esac
done

if ! ssh "$HOST" "test -f '$ABLAGE/$ABZUG'"; then
  echo "Abzug fehlt: $HOST:$ABLAGE/$ABZUG" >&2
  echo "Vorhanden:" >&2
  ssh "$HOST" "ls -1 '$ABLAGE'/*.dump 2>/dev/null | xargs -n1 basename" >&2 || true
  echo >&2
  echo "Einen Abzug nehmen: bash tools/velocity_sichern.sh --ausgangsstand" >&2
  exit 1
fi

echo "Zurücksetzen auf $ABZUG"
echo
echo "  jetzt in der Datenbank:"
ssh "$HOST" "docker exec '$BEHAELTER' psql -U postgres -d '$DATENBANK' -tA -F' ' -c \"
  select 'fahrrad', count(*) from velocity.fahrrad
  union all select 'kunde', count(*) from velocity.kunde
  union all select 'ausleihe', count(*) from velocity.ausleihe
  union all select 'station', count(*) from velocity.station
  union all select 'schadensmeldung', count(*) from velocity.schadensmeldung
  union all select 'wartungsprognose', count(*) from velocity.wartungsprognose\"" | sed 's/^/     /'
echo
echo "  im Abzug:"
ssh "$HOST" "cat '$ABLAGE/${ABZUG%.dump}.txt' 2>/dev/null || echo '(keine Zeugenliste)'" | sed 's/^/     /'
echo

if [[ $OHNE_RUECKFRAGE -eq 0 ]]; then
  # Ein Zuruecksetzen verwirft ALLES, was seit dem Abzug geschehen ist -
  # auch das, was jemand gerade absichtlich eingetragen hat. Deshalb ein
  # getipptes Wort und kein blosses "j": Enter aus Versehen soll nicht
  # genuegen.
  if [[ ! -t 0 ]]; then
    echo "Ohne Terminal braucht es --ja." >&2
    exit 2
  fi
  printf 'Alles seit diesem Abzug geht verloren. Zum Bestätigen "zurücksetzen" tippen: '
  read -r antwort
  if [[ "$antwort" != "zurücksetzen" ]]; then
    echo "Abgebrochen, nichts geändert."
    exit 1
  fi
fi

echo
echo "Spiele zurück ..."
ssh "$HOST" "
  set -e
  docker cp '$ABLAGE/$ABZUG' '$BEHAELTER:/tmp/rueck.dump' >/dev/null
  docker exec '$BEHAELTER' pg_restore -U postgres -d '$DATENBANK' \
      --clean --if-exists --single-transaction '/tmp/rueck.dump'
  docker exec '$BEHAELTER' rm -f '/tmp/rueck.dump'
"

# PostgREST haelt seinen Schemakatalog im Speicher. Nach einer
# Rueckspielung stehen dieselben Namen wieder da, aber nicht dieselben
# Objekte - ohne dieses Signal antwortet die Oberflaeche mit Fehlern, die
# wie ein Tippfehler aussehen. Derselbe Fall wie bei einer neu angelegten
# Sicht, siehe tools/schema_neu_lesen.sh.
echo
bash "$(dirname "$0")/schema_neu_lesen.sh"

echo
echo "  danach in der Datenbank:"
ssh "$HOST" "docker exec '$BEHAELTER' psql -U postgres -d '$DATENBANK' -tA -F' ' -c \"
  select 'fahrrad', count(*) from velocity.fahrrad
  union all select 'kunde', count(*) from velocity.kunde
  union all select 'ausleihe', count(*) from velocity.ausleihe
  union all select 'station', count(*) from velocity.station
  union all select 'schadensmeldung', count(*) from velocity.schadensmeldung
  union all select 'wartungsprognose', count(*) from velocity.wartungsprognose\"" | sed 's/^/     /'
echo
echo "Zurückgesetzt. Die Anmeldungen in auth sind unberührt geblieben."
