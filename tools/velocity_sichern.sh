#!/usr/bin/env bash
# =====================================================================
# Einen Abzug des Schemas velocity nehmen
#
# WARUM ES DAS GIBT
#
# Die Fallstudie soll eine Versuchsplattform sein: Studierende lassen
# einen Agenten auf die Warenwirtschaft los und sehen, was dabei
# herauskommt. Damit das gefahrlos ist, muss es einen Weg zurueck geben -
# und der fehlte bisher.
#
# Einige api_-Funktionen sind ABSICHTLICH nicht ruecknehmbar. Wer
# api_kunde_anonymisieren aufruft, loescht Vorname, Nachname und E-Mail
# unwiederbringlich; das ist der Zweck der Funktion (Art. 17 DSGVO) und
# kein Fehler. Ohne Abzug wuerde der erste Versuch die Fallstudie fuer
# den Rest des Semesters beschaedigen.
#
# WAS GESICHERT WIRD
#
# Nur das Schema velocity, in Postgres' eigenem Format (-Fc). Die
# Anmeldedaten liegen in auth.users und damit AUSSERHALB - ein
# Zuruecksetzen laesst also niemanden ausgesperrt zurueck. Geprueft ist
# ausserdem, dass kein Fremdschluessel und keine Sicht von aussen auf
# velocity zeigt; das Schema laesst sich deshalb als Ganzes ersetzen.
#
# Aufruf:
#   bash tools/velocity_sichern.sh                 ein Abzug mit Zeitstempel
#   bash tools/velocity_sichern.sh --ausgangsstand  zusaetzlich als Ausgangsstand
#                                                   ablegen (Ziel des Zuruecksetzens)
# =====================================================================
set -euo pipefail

HOST=${VELO_HOST:-bot.butscher.cloud}
BEHAELTER=${VELO_DB_BEHAELTER:-supabase-db}
ABLAGE=${VELO_SICHERUNG:-/opt/velocity-sicherung}
DATENBANK=${VELO_DB:-postgres}

AUSGANGSSTAND=0
if [[ "${1:-}" == "--ausgangsstand" ]]; then
  AUSGANGSSTAND=1
elif [[ -n "${1:-}" ]]; then
  echo "Unbekannte Angabe: $1" >&2
  echo "Aufruf: bash tools/velocity_sichern.sh [--ausgangsstand]" >&2
  exit 2
fi

STEMPEL=$(date +%Y-%m-%d_%H%M)
NAME="velocity_${STEMPEL}.dump"

echo "Abzug des Schemas velocity auf $HOST ($BEHAELTER) ..."

# Der Abzug entsteht IM Behaelter und wird danach herauskopiert: pg_dump
# gibt es nur dort, und der Weg ueber den Netzport waere langsamer und
# haette das Passwort im Kommando.
ssh "$HOST" "
  set -e
  mkdir -p '$ABLAGE'
  docker exec '$BEHAELTER' pg_dump -U postgres -d '$DATENBANK' \
      -n velocity -Fc -f '/tmp/$NAME'
  docker cp '$BEHAELTER:/tmp/$NAME' '$ABLAGE/$NAME'
  docker exec '$BEHAELTER' rm -f '/tmp/$NAME'

  # Ein Abzug ohne Zeugen ist schwer zu pruefen. Die Zeilenzahlen der
  # sechs Tabellen, an denen man einen Verlust zuerst merkt, kommen
  # deshalb als Textdatei daneben - sie sind der Massstab, gegen den
  # tools/velocity_zuruecksetzen.sh hinterher meldet.
  docker exec '$BEHAELTER' psql -U postgres -d '$DATENBANK' -tA -F' ' -c \"
    select 'fahrrad', count(*) from velocity.fahrrad
    union all select 'kunde', count(*) from velocity.kunde
    union all select 'ausleihe', count(*) from velocity.ausleihe
    union all select 'station', count(*) from velocity.station
    union all select 'schadensmeldung', count(*) from velocity.schadensmeldung
    union all select 'wartungsprognose', count(*) from velocity.wartungsprognose
  \" > '$ABLAGE/${NAME%.dump}.txt'
"

if [[ $AUSGANGSSTAND -eq 1 ]]; then
  # Der Ausgangsstand wird NICHT bei jedem Lauf ueberschrieben. Er ist
  # der Zustand, auf den zurueckgesetzt wird - wer ihn versehentlich mit
  # einem verunglueckten Versuch ueberschreibt, hat kein Zurueck mehr.
  # Deshalb braucht es dafuer die ausdrueckliche Angabe.
  ssh "$HOST" "
    cp '$ABLAGE/$NAME' '$ABLAGE/velocity_ausgangsstand.dump'
    cp '$ABLAGE/${NAME%.dump}.txt' '$ABLAGE/velocity_ausgangsstand.txt'
  "
fi

echo
ssh "$HOST" "
  ls -lh '$ABLAGE/$NAME' | awk '{print \"  \" \$9 \"  \" \$5}'
  echo '  gesichert:'
  sed 's/^/     /' '$ABLAGE/${NAME%.dump}.txt'
"
if [[ $AUSGANGSSTAND -eq 1 ]]; then
  echo "  zusätzlich als velocity_ausgangsstand.dump abgelegt"
fi
echo
echo "Zurückspielen: bash tools/velocity_zuruecksetzen.sh [$NAME]"
