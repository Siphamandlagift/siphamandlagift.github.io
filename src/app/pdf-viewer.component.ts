import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as pdfjsLib from 'pdfjs-dist';

// Use the bundled worker so no separate file copy is needed.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

@Component({
  selector: 'pdf-viewer',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pdf-shell">

      <!-- Loading / error state -->
      <div *ngIf="loading()" class="pdf-state-overlay">
        <div class="pdf-spinner"></div>
        <span>Loading PDF…</span>
      </div>
      <div *ngIf="errorMsg()" class="pdf-state-overlay pdf-error">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" stroke="#f87171" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span>{{ errorMsg() }}</span>
        <a *ngIf="src" [href]="src" target="_blank" rel="noopener" class="pdf-open-btn">Open in new tab</a>
      </div>

      <!-- Canvas area -->
      <div *ngIf="!loading() && !errorMsg()" class="pdf-canvas-wrap">
        <canvas #pdfCanvas class="pdf-canvas"></canvas>
      </div>

      <!-- Toolbar -->
      <div *ngIf="!loading() && !errorMsg() && totalPages() > 0" class="pdf-toolbar">
        <div class="pdf-nav">
          <button type="button" class="pdf-nav-btn" [disabled]="currentPage() <= 1" (click)="gotoPage(currentPage() - 1)" aria-label="Previous page">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>

          <span class="pdf-page-label">
            Page
            <input
              class="pdf-page-input"
              type="number"
              [min]="1"
              [max]="totalPages()"
              [value]="currentPage()"
              (change)="onPageInputChange($event)"
              aria-label="Current page" />
            of {{ totalPages() }}
          </span>

          <button type="button" class="pdf-nav-btn" [disabled]="currentPage() >= totalPages()" (click)="gotoPage(currentPage() + 1)" aria-label="Next page">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>

        <div class="pdf-zoom">
          <button type="button" class="pdf-nav-btn" (click)="adjustZoom(-0.25)" aria-label="Zoom out">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/><path d="m21 21-4.35-4.35M8 11h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
          <span class="pdf-zoom-label">{{ zoomLabel() }}</span>
          <button type="button" class="pdf-nav-btn" (click)="adjustZoom(0.25)" aria-label="Zoom in">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/><path d="m21 21-4.35-4.35M11 8v6M8 11h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
          <button type="button" class="pdf-nav-btn" title="Fit to width" (click)="resetZoom()" aria-label="Fit to width">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 8V6a2 2 0 0 1 2-2h2M4 16v2a2 2 0 0 0 2 2h2M16 4h2a2 2 0 0 1 2 2v2M16 20h2a2 2 0 0 0 2-2v-2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
          <a [href]="src" target="_blank" rel="noopener" class="pdf-nav-btn pdf-open-tab-btn" title="Open in new tab" aria-label="Open in new tab">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .pdf-shell {
      display: flex;
      flex-direction: column;
      border-radius: 16px;
      overflow: hidden;
      background: #0f172a;
      border: 1px solid rgba(255,255,255,0.07);
    }

    .pdf-state-overlay {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      min-height: 22rem;
      color: rgba(255,255,255,0.6);
      font-size: 0.9rem;
    }

    .pdf-error { color: #f87171; }

    .pdf-spinner {
      width: 36px;
      height: 36px;
      border: 3px solid rgba(99,102,241,0.25);
      border-top-color: #6366f1;
      border-radius: 50%;
      animation: spin 0.75s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .pdf-canvas-wrap {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      background: #1e293b;
      overflow: auto;
      min-height: 26rem;
      max-height: 70vh;
      padding: 1.5rem 1rem;
    }

    .pdf-canvas {
      display: block;
      box-shadow: 0 4px 32px rgba(0,0,0,0.55);
      border-radius: 4px;
      max-width: 100%;
    }

    .pdf-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.65rem 1rem;
      background: #0f172a;
      border-top: 1px solid rgba(255,255,255,0.07);
      flex-wrap: wrap;
    }

    .pdf-nav, .pdf-zoom {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .pdf-nav-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      background: rgba(255,255,255,0.05);
      color: rgba(255,255,255,0.75);
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
      text-decoration: none;
    }

    .pdf-nav-btn:hover:not(:disabled) {
      background: rgba(99,102,241,0.25);
      color: #fff;
      border-color: rgba(99,102,241,0.5);
    }

    .pdf-nav-btn:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    .pdf-page-label {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      color: rgba(255,255,255,0.65);
      font-size: 0.85rem;
      white-space: nowrap;
    }

    .pdf-page-input {
      width: 2.8rem;
      padding: 0.2rem 0.3rem;
      text-align: center;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 6px;
      background: rgba(255,255,255,0.07);
      color: #fff;
      font-size: 0.85rem;
      -moz-appearance: textfield;
    }

    .pdf-page-input::-webkit-inner-spin-button,
    .pdf-page-input::-webkit-outer-spin-button { -webkit-appearance: none; }

    .pdf-zoom-label {
      color: rgba(255,255,255,0.55);
      font-size: 0.82rem;
      min-width: 3rem;
      text-align: center;
    }

    .pdf-open-btn {
      margin-top: 0.5rem;
      padding: 0.4rem 1rem;
      border-radius: 8px;
      background: rgba(99,102,241,0.2);
      color: #818cf8;
      text-decoration: none;
      font-size: 0.85rem;
    }
  `],
})
export class PdfViewerComponent implements OnChanges, OnDestroy {
  @Input() src = '';
  @ViewChild('pdfCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly loading = signal(false);
  readonly errorMsg = signal('');
  readonly currentPage = signal(1);
  readonly totalPages = signal(0);
  readonly zoomLabel = signal('100%');

  private scale = 1.5;
  private fitScale = 1.5;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pdfDoc: any = null;
  private renderTask: { cancel(): void } | null = null;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['src'] && this.src) {
      this.loadPdf(this.src);
    }
  }

  ngOnDestroy() {
    this.renderTask?.cancel();
    this.pdfDoc?.destroy();
  }

  private async loadPdf(src: string) {
    this.loading.set(true);
    this.errorMsg.set('');
    this.currentPage.set(1);
    this.totalPages.set(0);
    this.renderTask?.cancel();
    this.pdfDoc?.destroy();
    this.pdfDoc = null;

    try {
      const loadingTask = pdfjsLib.getDocument(src);
      this.pdfDoc = await loadingTask.promise;
      this.totalPages.set(this.pdfDoc.numPages);
      this.loading.set(false);
      await this.renderPage(1);
    } catch {
      this.loading.set(false);
      this.errorMsg.set('Could not load PDF. You can open it in a new tab instead.');
    }
  }

  private async renderPage(pageNum: number) {
    if (!this.pdfDoc || !this.canvasRef) return;

    this.renderTask?.cancel();

    try {
      const page = await this.pdfDoc.getPage(pageNum);
      const canvas = this.canvasRef.nativeElement;

      // Fit to the container width on first render.
      const containerWidth = canvas.parentElement?.clientWidth ?? 800;
      const naturalViewport = page.getViewport({ scale: 1 });
      this.fitScale = Math.min(1.5, (containerWidth - 32) / naturalViewport.width);
      const viewport = page.getViewport({ scale: this.scale || this.fitScale });

      const context = canvas.getContext('2d')!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      this.renderTask = page.render({ canvasContext: context, viewport }) as { cancel(): void };
      await (this.renderTask as unknown as Promise<void>);
      this.updateZoomLabel();
    } catch {
      // cancelled — ignore
    }
  }

  gotoPage(page: number) {
    const clamped = Math.max(1, Math.min(page, this.totalPages()));
    this.currentPage.set(clamped);
    this.renderPage(clamped);
  }

  onPageInputChange(event: Event) {
    const val = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(val)) this.gotoPage(val);
  }

  adjustZoom(delta: number) {
    this.scale = Math.max(0.5, Math.min(3, this.scale + delta));
    this.renderPage(this.currentPage());
  }

  resetZoom() {
    this.scale = this.fitScale;
    this.renderPage(this.currentPage());
  }

  private updateZoomLabel() {
    this.zoomLabel.set(Math.round((this.scale / this.fitScale) * 100) + '%');
  }
}
