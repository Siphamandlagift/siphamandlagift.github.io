import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssessmentList } from './assessment-list';

describe('AssessmentList', () => {
  let component: AssessmentList;
  let fixture: ComponentFixture<AssessmentList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssessmentList],
    }).compileComponents();

    fixture = TestBed.createComponent(AssessmentList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
