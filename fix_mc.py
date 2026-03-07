import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. We need to revert the multiple choice option inputs back to checkboxes 
html = html.replace('type="radio" name="mcAnswer"', 'type="checkbox" name="mcAnswer"')
html = html.replace('rounded-full cursor-pointer', 'rounded cursor-pointer')

# 2. In checkQuestionReadiness(), the logic check for 'anyRadioSelected' might be slightly off.
html = re.sub(r'const anyRadioSelected.*?radio\.checked\);', 'const anyCheckboxSelected = Array.from(document.querySelectorAll(\'input[name="mcAnswer"]\')).some(checkbox => checkbox.checked);', html)
html = re.sub(r'allOptionsFilled && anyRadioSelected;', 'allOptionsFilled && anyCheckboxSelected;', html)

# 3. Inside addMultipleChoiceOption(), remove the event listener that unchecks other checkboxes 
html = re.sub(r'newOptionDiv\.querySelector\(\'input\[name="mcAnswer"\]\'\)\.addEventListener\(\'change\', function\(\) \{\s*if \(this\.checked\) \{\s*document\.querySelectorAll\(\'input\[name="mcAnswer"\]\'\)\.forEach\(cb => \{ if \(cb !== this\) cb\.checked = false; \}\);\s*\}\s*checkQuestionReadiness\(\);\s*\}\);', r"newOptionDiv.querySelector('input[name=\"mcAnswer\"]').addEventListener('change', checkQuestionReadiness);", html, flags=re.DOTALL)

# 4. Inside the main setup area for multiple choice (lines 4847+), remove event listener that unchecks other checkboxes.
html = re.sub(r'document\.querySelectorAll\(\'input\[name="mcAnswer"\]\'\)\.forEach\(checkbox => \{\s*checkbox\.addEventListener\(\'change\', function\(\) \{\s*if \(this\.checked\) \{\s*document\.querySelectorAll\(\'input\[name="mcAnswer"\]\'\)\.forEach\(cb => \{ if \(cb !== this\) cb\.checked = false; \}\);\s*\}\s*checkQuestionReadiness\(\);\s*\}\);\s*\}\);', r'''document.querySelectorAll('input[name="mcAnswer"]').forEach(checkbox => {
                            checkbox.addEventListener('change', checkQuestionReadiness);
                        });''', html, flags=re.DOTALL)

# 5. Question extraction logic
html = html.replace('const correctAnswerIndex = document.querySelector(\'input[name="mcAnswer"]:checked\')?.value;', 'const correctAnswers = Array.from(document.querySelectorAll(\'input[name="mcAnswer"]:checked\')).map(cb => parseInt(cb.value));')

# 6. The if guard
html = html.replace('if (!questionText || options.some(o => !o) || correctAnswerIndex === undefined) {', 'if (!questionText || options.some(o => !o) || correctAnswers.length === 0) {')
html = html.replace("Please fill in all multiple-choice fields and select the correct answer.", "Please fill in all multiple-choice fields and select at least one correct answer.")

# 7. Assignment to questionData
html = html.replace('correctAnswer: parseInt(correctAnswerIndex)', 'correctAnswer: correctAnswers')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
