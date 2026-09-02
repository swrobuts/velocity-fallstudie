"""Darstellungsbausteine fuer die Notebooks — zwei Themen zur Auswahl.

Das Thema wird ueber die Umgebungsvariable VELO_THEMA gesetzt:

    VELO_THEMA=neutral  Graustufen mit einem Akzent (Standard)
    VELO_THEMA=thws     Kursfarben wie im Foliendeck

WAS HIER DRIN IST UND WARUM

Kacheln, Faltungen und Tabellenstile sind reines HTML mit Inline-Stilen.
Colab und Jupyter rendern das; GitHub entfernt die style-Attribute und
zeigt die Struktur schlicht weiter an. Deshalb steckt die Bedeutung immer
in der Struktur (Ueberschrift, Tabelle, details/summary) und nur das
Aussehen im Stil — ein Notebook, dem die Stile fehlen, bleibt lesbar.

Die Plotly-Diagramme sind ausdruecklich eine ZUGABE. Jede Aussage, auf
der eine Freigabe beruht, steht weiterhin in einer Matplotlib-Grafik oder
in einer Textausgabe. GitHub entfernt die Skripte, die Plotly braucht;
waere eine Freigabeaussage nur dort zu sehen, waere sie auf GitHub
unsichtbar.
"""
from __future__ import annotations

import os

# ------------------------------------------------------------------ Themen

THEMEN = {
    "thws": {
        "akzent": "#003E6E",     # THWS-Blau
        "akzent_hell": "#4AB5C4",
        "flaeche": "#F7F5EF",    # Sand
        "flaeche_dunkel": "#E3DED1",
        "linie": "#C9C3B4",
        "text": "#404040",
        "text_sek": "#555148",
        "gut": "#55801C",
        "warnung": "#A32638",
        "reihe": ["#003E6E", "#4AB5C4", "#ED7004", "#8AB833", "#BE2344", "#FFB414"],
    },
    "neutral": {
        "akzent": "#2F2F2F",
        "akzent_hell": "#767676",
        "flaeche": "#FAFAFA",
        "flaeche_dunkel": "#EFEFEF",
        "linie": "#D8D8D8",
        "text": "#333333",
        "text_sek": "#6A6A6A",
        "gut": "#4A4A4A",
        "warnung": "#8C2F39",
        "reihe": ["#2F2F2F", "#767676", "#8C2F39", "#A8A8A8", "#5A5A5A", "#C4C4C4"],
    },
}


def thema() -> dict:
    return THEMEN.get(os.environ.get("VELO_THEMA", "neutral"), THEMEN["neutral"])


def thema_name() -> str:
    return os.environ.get("VELO_THEMA", "neutral")


# ------------------------------------------------------- Bausteine fuer Text

def kacheln(eintraege) -> str:
    """Kennzahlen auf einen Blick. eintraege = [(wert, beschriftung), ...]

    Als Tabelle gebaut, nicht als Flexbox: GitHub entfernt die Stile, und
    eine Tabelle bleibt dann in Zeile und Spalte lesbar, waehrend
    gestylte divs zu einer Textwurst zerfallen.
    """
    f = thema()
    zellen = []
    for wert, beschriftung in eintraege:
        zellen.append(
            f'<td style="background:{f["flaeche"]};border:1px solid {f["linie"]};'
            f'border-left:4px solid {f["akzent"]};padding:10px 16px;'
            f'vertical-align:top">'
            f'<div style="font-size:1.5em;font-weight:600;color:{f["akzent"]};'
            f'line-height:1.2">{wert}</div>'
            f'<div style="font-size:0.85em;color:{f["text_sek"]};'
            f'margin-top:2px">{beschriftung}</div></td>')
    return ('<table align="left" style="border-collapse:separate;border-spacing:8px 0;'
            'margin:6px 0 20px -8px"><tbody><tr>'
            + "".join(zellen) + '</tr></tbody></table>'
            '<div style="clear:both"></div>')


def faltung(titel: str, inhalt_html: str) -> str:
    """Vertiefung hinter einer Klappe. details/summary rendert GitHub mit."""
    f = thema()
    return (f'<details style="margin:12px 0 18px 0;border-left:3px solid '
            f'{f["linie"]};padding-left:14px">'
            f'<summary style="cursor:pointer;color:{f["akzent"]};font-weight:600;'
            f'padding:2px 0">{titel}</summary>'
            f'<div style="color:{f["text"]};line-height:1.55;padding-top:8px">'
            f'{inhalt_html}</div></details>')


def hinweis(titel: str, inhalt_html: str, warnung: bool = False) -> str:
    """Ein hervorgehobener Kasten — sparsam einsetzen."""
    f = thema()
    farbe = f["warnung"] if warnung else f["akzent"]
    return (f'<div style="background:{f["flaeche"]};border-left:4px solid {farbe};'
            f'padding:12px 16px;margin:14px 0;line-height:1.55">'
            f'<div style="color:{farbe};font-weight:600;margin-bottom:5px">'
            f'{titel}</div><div style="color:{f["text"]}">{inhalt_html}</div></div>')


# ---------------------------------------------------- Bausteine fuer Ausgaben

def tabelle_stil(df, balken=None, prozent=None, nachkomma=2):
    """pandas-Styler: Balken in einer Spalte, Prozentformat, Kopfzeile im Akzent.

    Der Styler erzeugt HTML mit Inline-Stilen und wird als Ausgabe
    gespeichert — er ueberlebt damit auch ohne laufenden Kernel.
    """
    f = thema()
    stil = (df.style
            .set_table_styles([
                {"selector": "th",
                 "props": [("text-align", "left"),
                           ("border-bottom", f"2px solid {f['akzent']}"),
                           ("color", f["akzent"]), ("padding", "6px 14px 6px 0")]},
                {"selector": "td",
                 "props": [("text-align", "left"),
                           ("border-bottom", f"1px solid {f['linie']}"),
                           ("padding", "5px 14px 5px 0")]},
            ])
            .hide(axis="index"))
    if balken:
        stil = stil.bar(subset=[balken], color=f["akzent_hell"], vmin=0)
    if prozent:
        stil = stil.format({s: "{:.1%}" for s in prozent})
    return stil


def plotly_layout(fig, titel="", hoehe=420):
    """Einheitliches Aussehen fuer alle interaktiven Diagramme."""
    f = thema()
    fig.update_layout(
        title=dict(text=titel, font=dict(size=15, color=f["akzent"])),
        height=hoehe,
        margin=dict(l=60, r=20, t=50 if titel else 20, b=50),
        plot_bgcolor="white", paper_bgcolor="white",
        font=dict(family="system-ui, -apple-system, Segoe UI, sans-serif",
                  size=12, color=f["text"]),
        colorway=f["reihe"],
        hoverlabel=dict(bgcolor="white", bordercolor=f["linie"]),
        legend=dict(orientation="h", yanchor="bottom", y=1.0, x=0),
    )
    fig.update_xaxes(showgrid=True, gridcolor=f["flaeche_dunkel"],
                     zeroline=False, linecolor=f["linie"])
    fig.update_yaxes(showgrid=True, gridcolor=f["flaeche_dunkel"],
                     zeroline=False, linecolor=f["linie"])
    return fig


def interaktiv(fig):
    """Gibt die Figur als HTML-Ausgabe aus — Plotly-Bibliothek vom CDN.

    include_plotlyjs="cdn" haelt die Zelle bei rund acht Kilobyte statt
    bei drei Megabyte. In Colab laedt das Skript und die Grafik ist
    bedienbar; auf GitHub wird es entfernt. Deshalb steht jede
    freigaberelevante Aussage zusaetzlich in einer statischen Grafik.
    """
    from IPython.display import HTML, display
    display(HTML(fig.to_html(include_plotlyjs="cdn", full_html=False,
                             config={"displaylogo": False,
                                     "modeBarButtonsToRemove": ["lasso2d",
                                                                "select2d"]})))


# ------------------------------------------------ Laufzeithelfer im Notebook
#
# WARUM DAS ALS QUELLTEXT UND NICHT ALS IMPORT
#
# Die Notebooks laufen in Colab, ohne dieses Verzeichnis. Ein
# "from gestaltung import ..." waere dort ein ImportError. Alles, was zur
# Laufzeit gebraucht wird, wandert deshalb als Zelle IN das Notebook; nur
# die Bausteine fuer den Fliesstext bleiben hier, weil sie beim Bau zu
# fertigem HTML werden.

def laufzeit_code() -> str:
    f = thema()
    return f'''
# ─── DARSTELLUNG ────────────────────────────────────────────────────
# Farben und Helfer fuer Tabellen und interaktive Diagramme. Rein
# kosmetisch: Keine Zahl und kein Urteil dieses Notebooks haengt daran.
FARBE = {{
    "akzent": "{f['akzent']}", "akzent_hell": "{f['akzent_hell']}",
    "flaeche": "{f['flaeche']}", "flaeche_dunkel": "{f['flaeche_dunkel']}",
    "linie": "{f['linie']}", "text": "{f['text']}",
    "gut": "{f['gut']}", "warnung": "{f['warnung']}",
    "reihe": {f['reihe']!r},
}}


def stil(rahmen, balken=None, prozent=None):
    """Ergebnistabelle mit Balken in einer Spalte und linksbuendigem Kopf."""
    s = (rahmen.style
         .set_table_styles([
             {{"selector": "th", "props": [("text-align", "left"),
              ("border-bottom", "2px solid " + FARBE["akzent"]),
              ("color", FARBE["akzent"]), ("padding", "6px 14px 6px 0")]}},
             {{"selector": "td", "props": [("text-align", "left"),
              ("border-bottom", "1px solid " + FARBE["linie"]),
              ("padding", "5px 14px 5px 0")]}}])
         .hide(axis="index"))
    if balken:
        s = s.bar(subset=[balken], color=FARBE["akzent_hell"], vmin=0)
    if prozent:
        s = s.format({{spalte: "{{:.1%}}" for spalte in prozent}})
    return s


def interaktiv(fig, titel="", hoehe=420):
    """Zeigt ein Plotly-Diagramm — in Colab bedienbar, auf GitHub nicht.

    Plotly wird ueber das CDN geladen; die Zelle bleibt dadurch bei rund
    acht Kilobyte. GitHub entfernt solche Skripte beim Rendern, deshalb
    steht jede freigaberelevante Aussage zusaetzlich in einer statischen
    Grafik oder in einer Textausgabe.
    """
    from IPython.display import HTML, display
    fig.update_layout(
        title=dict(text=titel, font=dict(size=15, color=FARBE["akzent"])),
        height=hoehe, margin=dict(l=60, r=20, t=50 if titel else 20, b=50),
        plot_bgcolor="white", paper_bgcolor="white",
        font=dict(family="system-ui, -apple-system, sans-serif", size=12,
                  color=FARBE["text"]),
        colorway=FARBE["reihe"],
        hoverlabel=dict(bgcolor="white", bordercolor=FARBE["linie"]),
        legend=dict(orientation="h", yanchor="bottom", y=1.0, x=0))
    fig.update_xaxes(showgrid=True, gridcolor=FARBE["flaeche_dunkel"],
                     zeroline=False, linecolor=FARBE["linie"])
    fig.update_yaxes(showgrid=True, gridcolor=FARBE["flaeche_dunkel"],
                     zeroline=False, linecolor=FARBE["linie"])
    display(HTML(fig.to_html(include_plotlyjs="cdn", full_html=False,
                             config={{"displaylogo": False}})))
'''
