# Assistant Fiche Livre / Book Sheet Generator

## Description (Français)

Assistant Fiche Livre est un générateur automatisé de fiches produit, meta descriptions SEO et textes de newsletter destiné aux librairies, bibliothèques et acteurs de l’édition.  
À partir d’une quatrième de couverture (texte collé ou image via OCR), l’application produit :

- Une fiche produit sobre et informative
- Une meta description optimisée pour le référencement naturel (SEO)
- Un texte de newsletter prêt à l’emploi

## Description (English)

Book Sheet Generator is an automated tool for generating product sheets, SEO meta descriptions, and newsletter texts aimed at bookstores, libraries, and publishing professionals.  
From a book’s back cover (pasted text or image via OCR), the app creates:

- A clean, informative product sheet
- An SEO-optimized meta description
- A ready-to-use newsletter snippet

## Stack / Technologies

- **Next.js** (App Router)
- **TypeScript**
- **React**
- **Tailwind CSS 4**
- **shadcn/ui** (component library)
- **OpenAI API** (gpt-3.5-turbo)

## OCR (Optical Character Recognition)

L’application prend en charge l’OCR à partir d’images de quatrièmes de couverture afin d’extraire automatiquement le texte source.

### Architecture OCR

L’OCR repose sur **Tesseract OCR**, exécuté **côté serveur**, via un wrapper Node.js.

- **node-tesseract-ocr**  
  Wrapper Node.js utilisé par l’application pour appeler Tesseract.

- **Tesseract OCR (binaire système)**  
  Moteur OCR installé au niveau du système (**non inclus dans `package.json`**).

- **Tessdata (langues)**  
  Données linguistiques nécessaires à la reconnaissance (ex : français).

⚠️ **Important**  
Le moteur OCR **n’est pas une dépendance JavaScript**.  
Il doit impérativement être installé sur la machine qui exécute l’application (serveur, VM, conteneur).
