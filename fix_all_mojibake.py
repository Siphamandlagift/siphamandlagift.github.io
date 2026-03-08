import re

def fix_cp437_mojibake(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        text = f.read()

    def fix_match(match):
        bad_str = match.group(0)
        try:
            # Re-encode as cp437 and decode as utf-8
            good_str = bad_str.encode('cp437').decode('utf-8')
            return good_str
        except:
            return bad_str

    # CP437 characters that are typically seen in UTF-8 mojibake:
    # We can just match any non-ascii character that is within the CP437 mapping but when encoded/decoded forms a valid utf-8 string.
    # An easier way is just try to decode *chunks* of text, or we can just find any non-ascii character sequence.
    
    # Let's find sequences of characters that are largely non-ascii (or ascii interspersed) that can be fixed
    # Actually, any string that CAN be encoded to cp437 and decoded to utf-8 successfully (and changes) could be fixed,
    # BUT we need to be careful not to corrupt already valid utf-8.
    # E.g. '⭐' (if it exists) will fail cp437 encoding, so it's safely ignored.
    # What if a valid word like 'café' (UTF-8) is processed?
    # 'café' uses 'é' (U+00E9). 
    # 'é'.encode('cp437') -> b'\x82'. b'\x82'.decode('utf-8') -> Fails!
    # So it's extremely safe to just try this on every word or sequence of non-ASCII characters!
    
    # Find any sequence of 2 or more characters containing at least one non-ascii char
    # UTF-8 encoded emojis/symbols become 2 to 4 CP437 characters.
    fixed_text = re.sub(r'[^\x00-\x7F]{2,6}', fix_match, text)
    
    # Some symbols like bullet point might be shorter?
    # e.g., '•' -> 'ΓÇó' -> 3 chars. 
    # Wait, 'Γ' is \u0393. Let's just run it over sequences of non-ASCII characters.
    
    # Wait, let's just do it directly on any sequence of non-ASCII.
    fixed_text2 = re.sub(r'([^\x00-\x7F]+)', fix_match, text)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(fixed_text2)
    
    print("CP437 mojibake fixed!")

fix_cp437_mojibake('C:/Users/sipha/OneDrive/Documentos/GitHub/siphamandlagift.github.io/index.html')
