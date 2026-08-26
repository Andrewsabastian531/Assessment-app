import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { pdfToPng } from 'pdf-to-png-converter';
import heicConvert from 'heic-convert';
import { MAX_PAGES_PER_SUBMISSION, RASTER_DPI, type BoundingBox } from '@vedaai/shared';

export interface RasterPage {
  pageIndex: number;
  png: Buffer;
  width: number;
  height: number;
}

/**
 * Turns whatever the teacher uploaded — PDF, JPG, PNG, HEIC — into a uniform
 * list of PNG page images that the vision model and the review canvas both use.
 */
@Injectable()
export class ImageService {
  private readonly logger = new Logger(ImageService.name);

  async rasterize(file: Buffer, mimeType: string): Promise<RasterPage[]> {
    if (mimeType === 'application/pdf') {
      return this.rasterizePdf(file);
    }
    return [await this.rasterizeImage(file, mimeType)];
  }

  private async rasterizePdf(file: Buffer): Promise<RasterPage[]> {
    // pdf-to-png-converter renders through pdf.js; viewportScale is relative to
    // the PDF's native 72dpi, so this yields RASTER_DPI.
    const rendered = await pdfToPng(file, {
      viewportScale: RASTER_DPI / 72,
    });

    if (rendered.length === 0) {
      throw new Error('The PDF contains no renderable pages');
    }

    const pages = rendered.slice(0, MAX_PAGES_PER_SUBMISSION);
    if (rendered.length > pages.length) {
      this.logger.warn(
        `PDF has ${rendered.length} pages; processing the first ${pages.length}`,
      );
    }

    return Promise.all(
      pages.map(async (page, pageIndex) => {
        if (!page.content) {
          throw new Error(`Page ${pageIndex + 1} of the PDF rendered empty`);
        }
        const normalized = await this.normalize(page.content);
        return { pageIndex, ...normalized };
      }),
    );
  }

  private async rasterizeImage(file: Buffer, mimeType: string): Promise<RasterPage> {
    let source = file;

    // sharp has no HEIC decoder unless libheif is compiled in, which it is not
    // in the prebuilt binaries — convert first.
    if (mimeType === 'image/heic' || mimeType === 'image/heif') {
      const converted = await heicConvert({
        buffer: file as unknown as ArrayBufferLike,
        format: 'JPEG',
        quality: 0.92,
      });
      source = Buffer.from(converted);
    }

    const normalized = await this.normalize(source);
    return { pageIndex: 0, ...normalized };
  }

  /**
   * Downscales oversized scans and flattens to PNG. Phone photos are routinely
   * 4000px wide, which wastes vision tokens without improving legibility.
   */
  private async normalize(
    input: Buffer,
  ): Promise<{ png: Buffer; width: number; height: number }> {
    const pipeline = sharp(input, { failOn: 'none' })
      .rotate() // honour EXIF orientation from phone cameras
      .resize({ width: 2000, height: 2600, fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9 });

    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
    return { png: data, width: info.width, height: info.height };
  }

  /**
   * Crops one answer region out of a page so the grader sees the handwriting at
   * full resolution instead of a downscaled whole page.
   */
  async cropRegion(
    page: Buffer,
    bbox: BoundingBox,
    padding = 0.015,
  ): Promise<Buffer | null> {
    try {
      const metadata = await sharp(page).metadata();
      const pageWidth = metadata.width ?? 0;
      const pageHeight = metadata.height ?? 0;
      if (!pageWidth || !pageHeight) return null;

      const left = Math.round(clamp01(bbox.x - padding) * pageWidth);
      const top = Math.round(clamp01(bbox.y - padding) * pageHeight);
      const width = Math.round(
        clamp01(Math.min(bbox.width + padding * 2, 1 - bbox.x + padding)) * pageWidth,
      );
      const height = Math.round(
        clamp01(Math.min(bbox.height + padding * 2, 1 - bbox.y + padding)) * pageHeight,
      );

      // A degenerate box from the model would make sharp throw.
      if (width < 8 || height < 8) return null;

      return await sharp(page)
        .extract({
          left: Math.min(left, pageWidth - 1),
          top: Math.min(top, pageHeight - 1),
          width: Math.min(width, pageWidth - left),
          height: Math.min(height, pageHeight - top),
        })
        .png()
        .toBuffer();
    } catch (error) {
      this.logger.warn(`Could not crop region: ${(error as Error).message}`);
      return null;
    }
  }
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
