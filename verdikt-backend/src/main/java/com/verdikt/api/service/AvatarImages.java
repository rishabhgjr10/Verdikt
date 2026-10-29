package com.verdikt.api.service;

import com.verdikt.api.exception.BadRequestException;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.ImageOutputStream;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Iterator;

/**
 * Turns an uploaded photo into the stored avatar: a center-cropped square JPEG. The image is always decoded and
 * re-encoded, so only pixels survive (no EXIF location, no embedded scripts, no polyglot files).
 */
public final class AvatarImages {

    public static final int SIZE = 256;
    /** Raw upload cap; the browser shrinks photos first, so real uploads are far smaller */
    public static final int MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
    /** Refuse huge dimensions before decoding, so a tiny file can't expand into gigabytes of pixels */
    private static final long MAX_PIXELS = 40_000_000L;

    private AvatarImages() {
    }

    public static byte[] process(byte[] upload) {
        if (upload == null || upload.length == 0) throw new BadRequestException("Choose a photo to upload.");
        if (upload.length > MAX_UPLOAD_BYTES) throw new BadRequestException("That photo is too large. Pick one under 5 MB.");
        BufferedImage source = decode(upload);

        int side = Math.min(source.getWidth(), source.getHeight());
        int x = (source.getWidth() - side) / 2;
        int y = (source.getHeight() - side) / 2;
        int out = Math.min(SIZE, side);

        BufferedImage square = new BufferedImage(out, out, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = square.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            // Transparent PNGs get the app's dark surface instead of JPEG's black
            g.setColor(new Color(0x18, 0x18, 0x1b));
            g.fillRect(0, 0, out, out);
            g.drawImage(source, 0, 0, out, out, x, y, x + side, y + side, null);
        } finally {
            g.dispose();
        }
        return encodeJpeg(square);
    }

    private static BufferedImage decode(byte[] upload) {
        try (ImageInputStream in = ImageIO.createImageInputStream(new ByteArrayInputStream(upload))) {
            Iterator<ImageReader> readers = in == null ? null : ImageIO.getImageReaders(in);
            if (readers == null || !readers.hasNext()) throw unsupported();
            ImageReader reader = readers.next();
            try {
                reader.setInput(in, true, true);
                long pixels = (long) reader.getWidth(0) * reader.getHeight(0);
                if (pixels <= 0 || pixels > MAX_PIXELS) {
                    throw new BadRequestException("That photo's dimensions are too large.");
                }
                BufferedImage image = reader.read(0);
                if (image == null) throw unsupported();
                return image;
            } finally {
                reader.dispose();
            }
        } catch (IOException | RuntimeException e) {
            if (e instanceof BadRequestException bad) throw bad;
            throw unsupported();
        }
    }

    private static byte[] encodeJpeg(BufferedImage image) {
        ImageWriter writer = ImageIO.getImageWritersByFormatName("jpeg").next();
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ImageOutputStream out = ImageIO.createImageOutputStream(bytes)) {
            writer.setOutput(out);
            ImageWriteParam param = writer.getDefaultWriteParam();
            param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            param.setCompressionQuality(0.86f);
            writer.write(null, new IIOImage(image, null, null), param);
        } catch (IOException e) {
            throw new IllegalStateException("Couldn't encode avatar", e);
        } finally {
            writer.dispose();
        }
        return bytes.toByteArray();
    }

    private static BadRequestException unsupported() {
        return new BadRequestException("That file isn't a photo we can read. Use a JPG or PNG.");
    }
}
