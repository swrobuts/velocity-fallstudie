#!/usr/bin/env bash
# =====================================================================
# PostgREST den Schemacache neu lesen lassen
#
# WARUM ES DAS GIBT
# Eine neu angelegte Sicht ist in der Datenbank sofort da - fuer die
# Oberflaeche aber nicht. PostgREST haelt einen Schemacache und kennt
# nur, was beim letzten Einlesen existierte. Die Folge ist eine Meldung,
# die wie ein Tippfehler aussieht, aber keiner ist:
#
#   Could not find the table 'velocity.v_wawi_...' in the schema cache
#
# Genau das ist am 30.08.2026 im laufenden Betrieb passiert, nachdem
# v_wawi_fahrten_je_tag_typ angelegt worden war. Zwei Dinge fehlten:
#
#   1. grant select ... to authenticated  (siehe die Liste in
#      0019_wawi_logik.sql - eine neue Sicht gehoert dort hinein)
#   2. dieser Aufruf hier
#
# WARUM SIGUSR1 UND NICHT NOTIFY
# "notify pgrst, 'reload schema'" ist der dokumentierte Weg und war der
# erste Versuch - er blieb an dieser Installation wirkungslos (sechsmal
# nachgemessen, weiter 404). SIGUSR1 wirkt sofort und ist trotzdem
# schonend: PostgREST liest nur das Schema neu, der Dienst laeuft
# durch, keine Anfrage bricht ab. Ein Neustart des Behaelters waere das
# groebere Mittel.
set -euo pipefail

HOST=${WAWI_HOST:-bot.butscher.cloud}
BEHAELTER=${WAWI_REST_BEHAELTER:-supabase-rest}

echo "PostgREST auf $HOST: Schemacache neu lesen ($BEHAELTER) ..."
ssh "$HOST" "docker kill --signal=SIGUSR1 $BEHAELTER" >/dev/null
echo "erledigt. Eine neue Sicht braucht ausserdem ihr 'grant select ... to authenticated'."
