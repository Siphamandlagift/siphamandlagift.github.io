import { Injectable, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { LMS_API_CONFIG, LmsApiConfig } from './lms-api.config';

export type UploadProgressEvent = { type: 'progress'; percent: number };
export type UploadCompleteEvent = { type: 'complete'; url: string; path: string };
export type UploadEvent = UploadProgressEvent | UploadCompleteEvent;

type UploadSessionResponse = {
  uploadUrl: string;
  publicUrl: string;
  path: string;
};

@Injectable({ providedIn: 'root' })
export class FirebaseStorageService {
  constructor(
    private readonly http: HttpClient,
    @Inject(LMS_API_CONFIG) private readonly config: LmsApiConfig,
  ) {}

  private createUploadSession(file: File, folder: string): Promise<UploadSessionResponse> {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    return new Promise((resolve, reject) => {
      this.http.post<UploadSessionResponse>(`${this.config.baseUrl}/storage/upload-url`, {
        folder,
        fileName: safeName,
        contentType: file.type || 'application/octet-stream',
      }).subscribe({
        next: resolve,
        error: reject,
      });
    });
  }

  upload(file: File, folder: string): Observable<{ url: string; path: string }> {
    return new Observable((observer) => {
      void (async () => {
        try {
          const session = await this.createUploadSession(file, folder);
          const uploadResult = await fetch(session.uploadUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': file.type || 'application/octet-stream',
            },
            body: file,
          });

          if (!uploadResult.ok) {
            throw new Error(`Upload failed with status ${uploadResult.status}.`);
          }

          observer.next({ url: session.publicUrl, path: session.path });
          observer.complete();
        } catch (err) {
          observer.error(err);
        }
      })();
    });
  }

  /** Emits progress events (0-100%) while uploading, then a completion event with the download URL. */
  uploadWithProgress(file: File, folder: string): Observable<UploadEvent> {
    return new Observable((observer) => {
      let xhr: XMLHttpRequest | null = null;

      void (async () => {
        try {
          const session = await this.createUploadSession(file, folder);
          xhr = new XMLHttpRequest();
          xhr.open('PUT', session.uploadUrl);
          xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

          xhr.upload.onprogress = (event) => {
            const percent = event.total > 0
              ? Math.round((event.loaded / event.total) * 100)
              : 0;
            observer.next({ type: 'progress', percent });
          };

          xhr.onerror = () => {
            observer.error(new Error('Upload failed due to a network error.'));
          };

          xhr.onload = () => {
            if (xhr && xhr.status >= 200 && xhr.status < 300) {
              observer.next({ type: 'complete', url: session.publicUrl, path: session.path });
              observer.complete();
              return;
            }

            observer.error(new Error(`Upload failed with status ${xhr?.status ?? 0}.`));
          };

          xhr.send(file);
        } catch (err) {
          observer.error(err);
        }
      })();

      return () => {
        if (xhr && xhr.readyState !== XMLHttpRequest.DONE) {
          xhr.abort();
        }
      };
    });
  }

  /** Uploads a file in small chunks relayed through our own server (see
   *  /storage/chunked-upload/* on the backend) instead of PUTing directly to Google Cloud
   *  Storage. The direct-to-storage path is broken here: GCS returns the finished object
   *  without CORS headers on the completing PUT, so the browser blocks reading the response
   *  even though the upload actually succeeded server-side. Relaying through our server (which
   *  talks to GCS itself, not subject to browser CORS) also sidesteps the single-request size
   *  ceiling a direct upload through Cloud Functions would hit — so there's no practical
   *  file-size limit here, just however long the chunks take to send. */
  uploadChunked(file: File, folder: string): Observable<UploadEvent> {
    // Kept modest — the relay's per-chunk latency to GCS is variable (server-observed anywhere
    // from ~300ms to ~9s per chunk, seemingly network jitter rather than anything proportional
    // we can fix here), so smaller chunks bound the worst case per request and fail (and retry)
    // faster than a single giant one would.
    const chunkSizeBytes = 2 * 1024 * 1024;
    const maxAttemptsPerChunk = 3;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');

    return new Observable((observer) => {
      let cancelled = false;

      const uploadNextChunk = (sessionId: string, publicUrl: string, uploadedBytes: number, attempt = 1) => {
        if (cancelled) {
          return;
        }

        const totalBytes = file.size;
        const chunkEnd = Math.min(uploadedBytes + chunkSizeBytes, totalBytes);
        const chunk = file.slice(uploadedBytes, chunkEnd);

        this.http.put<{ complete: boolean; url?: string; path?: string }>(
          `${this.config.baseUrl}/storage/chunked-upload/chunk`,
          chunk,
          {
            params: { sessionId, start: String(uploadedBytes), end: String(chunkEnd - 1), total: String(totalBytes) },
            headers: { 'Content-Type': 'application/octet-stream' },
          },
        ).subscribe({
          next: (result) => {
            observer.next({ type: 'progress', percent: Math.round((chunkEnd / totalBytes) * 100) });

            if (chunkEnd >= totalBytes) {
              observer.next({ type: 'complete', url: result.url ?? publicUrl, path: result.path ?? '' });
              observer.complete();
              return;
            }

            uploadNextChunk(sessionId, publicUrl, chunkEnd);
          },
          error: (err) => {
            if (cancelled) {
              return;
            }
            if (attempt < maxAttemptsPerChunk) {
              // Transient network hiccup — the session is still open server-side, so just retry
              // this same byte range rather than failing the whole upload over one bad request.
              uploadNextChunk(sessionId, publicUrl, uploadedBytes, attempt + 1);
              return;
            }
            observer.error(err);
          },
        });
      };

      this.http.post<{ sessionId: string; path: string; publicUrl: string }>(
        `${this.config.baseUrl}/storage/chunked-upload/start`,
        { folder, fileName: safeName, contentType: file.type || 'application/octet-stream' },
      ).subscribe({
        next: ({ sessionId, publicUrl }) => uploadNextChunk(sessionId, publicUrl, 0),
        error: (err) => observer.error(err),
      });

      return () => {
        cancelled = true;
      };
    });
  }
}
