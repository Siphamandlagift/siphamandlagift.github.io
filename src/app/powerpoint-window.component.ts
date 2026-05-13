import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { DOCUMENT } from '@angular/common';

@Component({
  selector: 'powerpoint-window',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'powerpoint-window-host',
    role: 'region',
    '[attr.aria-label]': 'viewerTitle()',
  },
  template: `
    <section class="powerpoint-window-shell">
      <div class="powerpoint-window-actions">
        <button
          type="button"
          class="powerpoint-window-download-btn"
          [disabled]="!hasDownloadSource()"
          (click)="downloadPresentation()">{{ downloadLabel() }}</button>
      </div>
    </section>
  `,
  styles: [`
    :host {
      display: block;
      min-width: 0;
    }

    .powerpoint-window-shell {
      display: flex;
      justify-content: flex-start;
    }

    .powerpoint-window-actions {
      display: flex;
      justify-content: flex-start;
    }

    .powerpoint-window-download-btn {
      width: fit-content;
      margin-top: 0.35rem;
      border: 0;
      border-radius: 12px;
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      color: #fff;
      padding: 0.7rem 1rem;
      font: inherit;
      font-size: 0.84rem;
      font-weight: 700;
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
    }

    .powerpoint-window-download-btn:hover,
    .powerpoint-window-download-btn:focus-visible {
      transform: translateY(-1px);
      box-shadow: 0 10px 20px rgba(79, 70, 229, 0.16);
      outline: none;
    }

    .powerpoint-window-download-btn:disabled {
      cursor: default;
      opacity: 0.5;
      transform: none;
      box-shadow: none;
    }
  `],
})
export class PowerPointWindowComponent {
  private readonly document = inject(DOCUMENT);

  readonly downloaded = output<void>();
  readonly viewerTitle = input('PowerPoint file');
  readonly emptyMessage = input('');
  readonly sourceDataUrl = input<string | null>(null);
  readonly sourceFileName = input('presentation.pptx');
  readonly downloadLabel = input('Download presentation');
  readonly downloadNote = input('');

  readonly hasDownloadSource = computed(() => Boolean(this.sourceDataUrl()?.trim()));

  downloadPresentation() {
    const dataUrl = this.sourceDataUrl()?.trim();
    if (!dataUrl) {
      return;
    }

    const objectUrl = URL.createObjectURL(this.dataUrlToBlob(dataUrl));
    const link = this.document.createElement('a');
    link.href = objectUrl;
    link.download = this.sourceFileName().trim() || 'presentation.pptx';

    this.document.body.appendChild(link);
    link.click();
    link.remove();
    this.downloaded.emit();

    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }

  private dataUrlToBlob(dataUrl: string) {
    const [metadata, base64Payload = ''] = dataUrl.split(',', 2);
    const mimeType = metadata.match(/^data:([^;]+)/i)?.[1] || 'application/octet-stream';
    const binary = atob(base64Payload);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return new Blob([bytes], { type: mimeType });
  }
}