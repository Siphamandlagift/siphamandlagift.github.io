
text = open('index.html', encoding='utf-8').read()
if 'Assign Courses to Group' not in text:
    print('UI cleanup for courses in groups completely verfied.')
else:
    print('Failed to remove UI section')
