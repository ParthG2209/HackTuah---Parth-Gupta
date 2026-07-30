import io
import PyPDF2

def parse_pdf(file_bytes: bytes) -> str:
    """Extracts text from PDF bytes."""
    try:
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
        text = ""
        for page in pdf_reader.pages:
            content = page.extract_text()
            if content:
                text += content + "\n"
        return text.strip()
    except Exception as e:
        return f"[PDF Parse Error: {str(e)}]"

def parse_docx(file_bytes: bytes) -> str:
    """Extracts text from Docx bytes using simple zipfile parse (no python-docx dep needed)."""
    import zipfile
    import xml.etree.ElementTree as ET
    try:
        z = zipfile.ZipFile(io.BytesIO(file_bytes))
        doc_xml = z.read('word/document.xml')
        root = ET.fromstring(doc_xml)
        text = []
        for el in root.iter():
            if el.tag.endswith('t') and el.text:
                text.append(el.text)
        return '\n'.join(text).strip()
    except Exception as e:
        return f"[Docx Parse Error: {str(e)}]"

def parse_document(filename: str, file_bytes: bytes) -> str:
    if filename.lower().endswith('.pdf'):
        return parse_pdf(file_bytes)
    elif filename.lower().endswith('.docx'):
        return parse_docx(file_bytes)
    else:
        # Fallback to standard text decoding
        try:
            return file_bytes.decode('utf-8')
        except Exception:
            return "[Unsupported File Format]"
