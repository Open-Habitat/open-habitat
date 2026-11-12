# Tulos: Pythonin asiakirjakirjastot jokaiseen asennukseen

Ytimen Ubuntu-vaatimuksiin (`runtime/core/ubuntu-packages.json`) lisättiin
neljä pakettia, kaikki `architecture: all`, vähimmäisversiona noblen nykyinen:

| Paketti | Versio | Mihin |
|---|---|---|
| `python3-openpyxl` | 3.1.2+dfsg-6 | Excel `.xlsx` luku ja kirjoitus |
| `python3-docx` | 1.1.0+dfsg-2 | Word `.docx` luku ja kirjoitus |
| `python3-pypdf` | 4.0.2-1 | PDF:n teksti, sivut, yhdistäminen |
| `python3-xlrd` | 2.0.1-2 | vanha Excel `.xls` (vain luku) |

Kaikki ovat noblen universessa sekä amd64:lle että arm64:lle (arm64 tarkistettu
ports.ubuntu.comin `binary-arm64`-indeksistä). Host apt hoitaa riippuvuudet
(`python3`, `python3-lxml`, `python3-et-xmlfile`, Pillow ym.).

**Ydin muuttuu: seuraava julkaisu tarvitsee ytimen uudelleenrakennuksen
(`--rebuilt`).** Testikoneella kirjastot tulevat vasta sen myötä.

## Tarkistukset

- `bash scripts/test-ubuntu-requirements.sh` (oikea apt-sovitin kertakäyttöisessä
  rootless Ubuntu 24.04 -kontissa, kaikki profiilit): `ALL_UBUNTU_REQUIREMENTS_PASS`.
- `python3 scripts/test-profile-runtime-build.py`: 16 testiä OK; ytimen
  `ubuntu_requirements` hyväksyy listan molemmille kohteille (38 pakettia).
- `go test ./internal/host -run 'TestRelease(PlatformPackages|RejectsUbuntuPayload)|TestDebVersion|Ubuntu'`: ok.
- Toiminnallinen savutesti kertakäyttöisessä kontissa: xlsx-, docx- ja
  PDF-tiedosto kirjoitettiin ja luettiin takaisin; `import xlrd` toimii.
- Ytimen täyttä rakennusta (`build-core-runtime.sh`) ei ajettu: lista on
  sen ainoa muuttunut syöte ja sama `ubuntu_requirements`-jäsennys on testattu.

Katselmointi: keskittynyt oma katselmointi (pelkkä manifestilistan muutos, ei
istuntoja, sopimusta, daemonin tilaa tai valtuusrajaa).

## Päätökset myöhempää tarkistusta varten

- **`python3-pptx` puuttuu**: pakettia ei ole Ubuntu 24.04:ssä lainkaan.
  Vaihtoehdot: pip/uv-profiili tai oma wheel ytimeen. Ydin ei toimita
  Ubuntun ulkopuolisia Python-paketteja, joten jätettiin pois; PowerPointia
  tarvitseva agentti käyttää uv-profiilia.
- **`python3-xlrd` mukaan**: pieni puhdas Python ilman riippuvuuksia, ja vanhoja
  `.xls`-tiedostoja tulee yhä vastaan (vanhat järjestelmäviennit).
- **`python3-lxml` ei suoraan**: tulee openpyxl:n ja docx:n riippuvuutena;
  suora nimeäminen ei lisäisi mitään.
- **`python3-pandas` pois**: suuri (numpy ym.), eikä tavallinen asiakirjatyö
  sitä vaadi; openpyxl ja stdlibin `csv` riittävät. CSV ei tarvitse pakettia.
- **`poppler-utils` / `python3-pdfminer` pois**: pypdf kattaa tavallisen
  tekstin poiminnan; joukko pidettiin pienenä.
- **Agenttiteksti ei muutu**: `internal/daemon/host-context.md` ei luettele
  asennettuja työkaluja (ei gitiä, gh:ta tai tmuxia), vaan käskee tarkistaa
  työkalut itse, eikä mikään taito puhu Python-kirjastoista. Agentti löytää
  kirjastot kokeilemalla `import`ia, joten `agent-text.md`:tä ei kirjoitettu.
