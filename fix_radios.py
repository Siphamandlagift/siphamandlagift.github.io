import re

with open("index.html", "r", encoding="utf-8") as f:
    html = f.read()

fix_css = """
        /* Restore native appearance for radios and checkboxes */
        input[type="radio"], input[type="checkbox"] {
            -webkit-appearance: auto !important;
            -moz-appearance: auto !important;
            appearance: auto !important;
        }
"""

if 'Restore native appearance for radios and checkboxes' not in html:
    html = html.replace("</style>", fix_css + "\n    </style>", 1)

    with open("index.html", "w", encoding="utf-8") as f:
        f.write(html)
    print("Fixed radio buttons visibility.")
else:
    print("Radio buttons visibility already fixed.")
