package com.verdikt.api.service;

import com.verdikt.api.exception.BadRequestException;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Shared account rules for sign-up and profile changes. Usernames can never contain "@" and emails always do, so the
 * two columns can never collide (a collision let one account lock another out when lookups matched either column).
 */
public final class AccountRules {

    public static final Pattern USERNAME = Pattern.compile("^[A-Za-z0-9._]{3,30}$");
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    public static final int PASSWORD_MIN = 8;
    /** BCrypt only reads the first 72 bytes; longer passwords would be silently truncated */
    public static final int PASSWORD_MAX_BYTES = 72;

    private AccountRules() {
    }

    public static String username(String raw) {
        String v = raw == null ? "" : raw.trim();
        if (!USERNAME.matcher(v).matches()) {
            throw new BadRequestException("Use 3 to 30 characters: letters, numbers, dots and underscores only.");
        }
        return v;
    }

    public static String email(String raw) {
        String v = raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
        if (v.length() > 255 || !EMAIL.matcher(v).matches()) {
            throw new BadRequestException("Enter a valid email address.");
        }
        return v;
    }

    public static String password(String raw) {
        if (raw == null || raw.length() < PASSWORD_MIN) {
            throw new BadRequestException("Use a password of at least " + PASSWORD_MIN + " characters.");
        }
        if (raw.getBytes(StandardCharsets.UTF_8).length > PASSWORD_MAX_BYTES) {
            throw new BadRequestException("That password is too long. Use at most " + PASSWORD_MAX_BYTES + " characters.");
        }
        return raw;
    }
}
