package com.verdikt.api.controller;

import org.springframework.dao.DataIntegrityViolationException;

import java.util.function.Supplier;

/**
 * First-time writes check for a row, then insert it. Two near-simultaneous requests (a double tap) can both miss and
 * both insert; the second hits the unique key and its transaction rolls back. Running it once more finds the row the
 * first one made, so the user sees the normal result instead of "A data conflict occurred".
 */
final class ConflictRetry {

    private ConflictRetry() {
    }

    static <T> T once(Supplier<T> write) {
        try {
            return write.get();
        } catch (DataIntegrityViolationException raced) {
            return write.get();
        }
    }
}
