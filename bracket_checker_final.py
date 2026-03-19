import re

with open('js/main.js', 'r', encoding='utf-8') as f:
    text = f.read()

stack = []
in_str = False
str_char = ''
in_line_comment = False
in_block_comment = False
escape_next = False

for i, char in enumerate(text):
    if escape_next:
        escape_next = False
        continue
    
    if char == '\\\\':
        escape_next = True
        continue
        
    if not in_str and not in_line_comment and not in_block_comment:
        if char == '/' and i+1 < len(text) and text[i+1] == '/':
            in_line_comment = True
        elif char == '/' and i+1 < len(text) and text[i+1] == '*':
            in_block_comment = True
        elif char in ["'", '"', "`"]:
            in_str = True
            str_char = char
        elif char in ['{', '[', '(']:
            stack.append((char, i))
        elif char in ['}', ']', ')']:
            if not stack:
                print(f"Stack empty but found {char} at index {i}")
                print(text[max(0, i-50):i+50])
                break
            top_char, top_i = stack.pop()
            if (char == '}' and top_char != '{') or (char == ']' and top_char != '[') or (char == ')' and top_char != '('):
                print(f"Mismatched! Found {char} but expected match for {top_char} (opened at {top_i}) at index {i}")
                print("Context:")
                print(text[max(0, i-200):min(len(text), i+200)])
                print("----------------------")
                # stop checking
                break
    else:
        if in_line_comment and char == '\n':
            in_line_comment = False
        elif in_block_comment and char == '*' and i+1 < len(text) and text[i+1] == '/':
            in_block_comment = False
        elif in_str and char == str_char:
            in_str = False

if stack:
    print(f"Final stack not empty! {stack[-5:]}")
else:
    print("Everything matched perfectly!")
