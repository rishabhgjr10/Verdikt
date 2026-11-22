package com.verdikt.api.service;

import com.verdikt.api.User;
import com.verdikt.api.dto.AuthRequest;
import com.verdikt.api.dto.AuthResponse;
import com.verdikt.api.exception.BadRequestException;
import com.verdikt.api.repository.UserRepository;
import com.verdikt.api.security.JwtTokenProvider;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.Optional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider tokenProvider;
    /** Hash of a random throwaway value, checked when the account doesn't exist so both failures take as long */
    private final String dummyHash;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder,
                       AuthenticationManager authenticationManager, JwtTokenProvider tokenProvider) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.tokenProvider = tokenProvider;
        this.dummyHash = passwordEncoder.encode(java.util.UUID.randomUUID().toString());
    }

    @Transactional
    public AuthResponse register(AuthRequest request) {
        String username = AccountRules.username(request.getUsername());
        String email = AccountRules.email(request.getEmail());
        String password = AccountRules.password(request.getPassword());
        // Checked against both columns: older accounts may predate the no-"@" username rule
        if (userRepository.existsByUsername(username) || userRepository.existsByEmail(username)) {
            throw new BadRequestException("Username is already taken!");
        }
        if (userRepository.existsByEmail(email) || userRepository.existsByUsername(email)) {
            throw new BadRequestException("Email address already in use!");
        }

        User user = User.builder()
                .username(username)
                .email(email)
                .passwordHash(passwordEncoder.encode(password))
                .avatarUrl(Avatars.defaultFor(username))
                .build();

        User savedUser = userRepository.save(user);
        String token = tokenProvider.generateToken(savedUser.getUsername(), savedUser.getTokenVersion());

        return AuthResponse.builder()
                .token(token)
                .id(savedUser.getId())
                .username(savedUser.getUsername())
                .email(savedUser.getEmail())
                .avatarUrl(savedUser.getAvatarUrl())
                .build();
    }

    @Transactional(readOnly = true)
    public AuthResponse login(AuthRequest request) {
        String identifier = request.getUsername() != null && !request.getUsername().isBlank()
                ? request.getUsername()
                : request.getEmail();

        if (identifier == null || identifier.isBlank()) {
            throw new BadRequestException("Username or email is required for login");
        }

        // An "@" means an email; anything else is a username. One column per lookup, never both at once.
        String id = identifier.trim();
        Optional<User> found = id.contains("@")
                // Older accounts may have an "@" in the username, so a miss on email falls back to that column alone
                ? userRepository.findByEmail(id.toLowerCase(Locale.ROOT)).or(() -> userRepository.findByUsername(id))
                : userRepository.findByUsername(id);
        if (found.isEmpty()) {
            // Same status and roughly the same time as a wrong password, so login can't reveal which accounts exist
            passwordEncoder.matches(request.getPassword() == null ? "" : request.getPassword(), dummyHash);
            throw new BadCredentialsException("Invalid username/email or password");
        }
        User user = found.get();

        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(user.getUsername(), request.getPassword())
        );

        String token = tokenProvider.generateToken(authentication);

        return AuthResponse.builder()
                .token(token)
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .avatarUrl(user.getAvatarUrl())
                .build();
    }
}
