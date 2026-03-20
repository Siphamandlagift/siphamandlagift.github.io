import re

with open('js/main.js', 'r', encoding='utf-8') as f:
    text = f.read()

# show me the initData or loadData
start = text.find('function initApp')
if start != -1:
    print(text[start:start+1000])

start = text.find('async function loadInitialData')
if start != -1:
    print(text[start:start+1000])
