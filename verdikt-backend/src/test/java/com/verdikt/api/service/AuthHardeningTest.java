package com.verdikt.api.service;

import com.verdikt.api.dto.AuthRequest;
import com.verdikt.api.exception.BadRequestException;
import com.verdikt.api.repository.UserRepository;
import com.verdikt.api.security.CustomUserDetailsService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.test.context.ActiveProfiles;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Sign-up validation and the username/email collision that let one account lock another out. */
@SpringBootTest
@ActiveProfiles("test")
class AuthHardeningTest {

    @Autowired AuthService authService;
    @Autowired CustomUserDetailsService userDetailsService;
    @Autowired UserRepository userRepository;

    private static String unique(String prefix) {
        return prefix + UUID.randomUUID().toString().substring(0, 8);
    }

    private static AuthRequest req(String username, String email, String password) {
        return AuthRequest.builder().username(username).email(email).password(password).build();
    }

    @Test
    void emailThatIsSomeonesUsernameCannotRegister() {
        String alice = unique("alice");
        authService.register(req(alice, alice + "@example.test", "correct horse"));

        // The old attack: an email field set to the victim's username. Now not even a valid email.
        assertThatThrownBy(() -> authService.register(req(unique("mal"), alice, "correct horse")))
                .isInstanceOf(BadRequestException.class);
        // Alice's session lookup still resolves to exactly her account
        assertThat(userDetailsService.loadUserByUsername(alice).getUsername()).isEqualTo(alice);
    }

    @Test
    void signUpRulesAreEnforcedServerSide() {
        assertThatThrownBy(() -> authService.register(req("a@b", "x@example.test", "correct horse")))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> authService.register(req(unique("u"), "not-an-email", "correct horse")))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> authService.register(req(unique("u"), unique("e") + "@example.test", "short")))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> authService.register(req(unique("u"), unique("e") + "@example.test", "x".repeat(73))))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void loginByEmailWorksAndUnknownAccountsLookLikeWrongPasswords() {
        String bob = unique("bob");
        authService.register(req(bob, bob + "@Example.test", "correct horse"));

        assertThat(authService.login(req(null, bob + "@example.TEST", "correct horse")).getUsername()).isEqualTo(bob);
        assertThatThrownBy(() -> authService.login(req(bob, null, "wrong password")))
                .isInstanceOf(BadCredentialsException.class);
        assertThatThrownBy(() -> authService.login(req(unique("ghost"), null, "whatever1")))
                .isInstanceOf(BadCredentialsException.class);
    }
}
