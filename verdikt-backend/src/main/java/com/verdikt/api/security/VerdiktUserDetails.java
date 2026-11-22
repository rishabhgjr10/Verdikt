package com.verdikt.api.security;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.User;

import java.util.Collection;

/** The signed-in user plus the token version their tokens must carry to still be accepted */
public class VerdiktUserDetails extends User {

    private final int tokenVersion;

    public VerdiktUserDetails(String username, String password, Collection<? extends GrantedAuthority> authorities,
                              int tokenVersion) {
        super(username, password, authorities);
        this.tokenVersion = tokenVersion;
    }

    public int getTokenVersion() {
        return tokenVersion;
    }
}
