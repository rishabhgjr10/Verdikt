package com.verdikt.api.service;

import com.verdikt.api.exception.BadRequestException;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Generated avatars. The server builds every avatar URL itself from an allowlisted DiceBear style and a plain seed,
 * so a client can never store an arbitrary image URL that is then shown to every visitor.
 */
public final class Avatars {

    /** Minimal styles offered in Edit Profile; the first one is the default for new accounts */
    public static final List<String> STYLES = List.of("initials", "thumbs", "shapes", "glass", "notionists-neutral", "lorelei-neutral");

    public static final String DEFAULT_STYLE = STYLES.get(0);

    private static final Pattern SEED = Pattern.compile("^[A-Za-z0-9._-]{1,64}$");

    private static final String BASE = "https://api.dicebear.com/9.x/";

    private Avatars() {
    }

    public static String url(String style, String seed) {
        if (style == null || !STYLES.contains(style)) {
            throw new BadRequestException("Pick one of the avatar styles shown.");
        }
        if (seed == null || !SEED.matcher(seed).matches()) {
            throw new BadRequestException("Avatar seed may only use letters, numbers, dots, dashes and underscores.");
        }
        return BASE + style + "/svg?seed=" + URLEncoder.encode(seed, StandardCharsets.UTF_8);
    }

    public static String defaultFor(String username) {
        return url(DEFAULT_STYLE, seedFrom(username));
    }

    /** A valid seed from any username (older accounts may contain characters the seed pattern rejects) */
    public static String seedFrom(String username) {
        String seed = username == null ? "" : username.replaceAll("[^A-Za-z0-9._-]", "_");
        if (seed.length() > 64) seed = seed.substring(0, 64);
        return seed.isEmpty() ? "verdikt" : seed;
    }

    /** The old cartoon style every account got at sign-up before minimal avatars */
    public static boolean isLegacy(String avatarUrl) {
        return avatarUrl == null || avatarUrl.isBlank() || avatarUrl.contains("/avataaars/");
    }
}
