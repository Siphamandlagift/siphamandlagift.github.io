import { Component } from '@angular/core';
// ...existing code...
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QuizService } from './quiz.service';

interface Assessment {
  id: number;
  section: string;
  question: string;
  answer?: string;
  submittedBy: number[];
}

@Component({
  selector: 'app-assessments',
  standalone: true,
  template: `
    <h2>Assessments</h2>
    <table border="1" cellpadding="4" style="margin-top:1rem; width:100%; max-width:700px;">
      <tr><th>Section</th><th>Question</th><th>Your Answer</th><th>Action</th></tr>
      <tr *ngFor="let a of assessments">
        <td>{{ a.section }}</td>
        <td>{{ a.question }}</td>
        <td>
          <input [(ngModel)]="a.answer" [readonly]="a.submittedBy.includes(currentUserId)" />
        </td>
        <td>
          <button *ngIf="!a.submittedBy.includes(currentUserId)" (click)="submit(a)">Submit</button>
          <span *ngIf="a.submittedBy.includes(currentUserId)" style="color:green;">Submitted</span>
        </td>
      </tr>
    </table>

    <h2 style="margin-top:2rem;">Quiz</h2>
    <table border="1" cellpadding="4" style="margin-top:1rem; width:100%; max-width:700px;">
      <tr><th>Section</th><th>Question</th><th>Options</th><th>Your Answer</th><th>Result</th></tr>
      <tr *ngFor="let q of quizService.questions()">
        <td>{{ q.section }}</td>
        <td>{{ q.question }}</td>
        <td>
          <span *ngFor="let opt of q.options">
            <label>
              <input type="radio" name="quiz{{q.id}}" [value]="opt" [checked]="quizService.getUserAnswer(q.id, currentUserId) === opt" (change)="answerQuiz(q.id, opt)" [disabled]="quizService.getUserAnswer(q.id, currentUserId)" />
              {{ opt }}
            </label><br />
          </span>
        </td>
        <td>{{ quizService.getUserAnswer(q.id, currentUserId) }}</td>
        <td>
          <span *ngIf="quizService.getUserAnswer(q.id, currentUserId)">
            <span *ngIf="quizService.isCorrect(q.id, currentUserId)" style="color:green;">Correct</span>
            <span *ngIf="!quizService.isCorrect(q.id, currentUserId)" style="color:red;">Incorrect</span>
          </span>
        </td>
      </tr>
    </table>
  `,
  imports: [CommonModule, FormsModule],
  providers: [QuizService],
})
export class AssessmentsComponent {
  currentUserId = 1; // Simulate logged-in user
  assessments: Assessment[] = [
    { id: 1, section: 'Introduction', question: 'What is Angular?', submittedBy: [] },
    { id: 2, section: 'Components', question: 'Explain Angular components.', submittedBy: [] }
  ];
  constructor(public quizService: QuizService) {}

  submit(a: Assessment) {
    if (a.answer && !a.submittedBy.includes(this.currentUserId)) {
      a.submittedBy.push(this.currentUserId);
    }
  }

  answerQuiz(qid: number, answer: string) {
    this.quizService.submitAnswer(qid, this.currentUserId, answer);
  }
}