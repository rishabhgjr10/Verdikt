package com.verdikt.api.config;

import com.verdikt.api.security.JwtAuthenticationFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.io.IOException;
import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // Permit all OPTIONS preflight requests globally
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                        // Auth endpoints
                        .requestMatchers("/auth/**", "/api/auth/**", "/api/v1/auth/**").permitAll()

                        // Per-user media state, library and collections (must precede the public media rule)
                        .requestMatchers("/api/media/*/me", "/api/media/*/watched", "/api/media/*/watch-later", "/api/media/*/favorite").authenticated()
                        .requestMatchers("/api/me/**", "/api/collections", "/api/collections/**").authenticated()

                        // Media endpoints (search, catalog, external) - permit public access
                        .requestMatchers("/media/**", "/api/media/**", "/api/v1/media/**").permitAll()

                        // Public GET endpoints for reviews
                        .requestMatchers(HttpMethod.GET, "/reviews/**", "/api/reviews/**", "/api/v1/reviews/**").permitAll()

                        // Uploaded profile photos, shown next to public reviews
                        .requestMatchers(HttpMethod.GET, "/api/avatars/*").permitAll()

                        // Weekly homepage selections
                        .requestMatchers(HttpMethod.GET, "/api/discovery/**").permitAll()

                        // System / Error / Health endpoints
                        .requestMatchers("/error", "/favicon.ico", "/", "/api/health").permitAll()
                        .requestMatchers(HttpMethod.GET, "/health").permitAll()

                        // Any other endpoint requires JWT authentication
                        .anyRequest().authenticated()
                )
                // Missing/invalid token -> 401 JSON (the default would be a bare 403)
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((request, response, authException) ->
                                writeError(response, HttpStatus.UNAUTHORIZED, "Authentication required."))
                        .accessDeniedHandler((request, response, accessDeniedException) ->
                                writeError(response, HttpStatus.FORBIDDEN, "This action is not allowed.")))
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    /**
     * The only origins allowed to call the API from a browser: the deployed frontends and local dev. Set
     * CORS_ALLOWED_ORIGINS (comma-separated) to change the list, e.g. to add a custom domain.
     */
    @Value("${CORS_ALLOWED_ORIGINS:https://verdikt-two.vercel.app,https://verdiikt.vercel.app,https://verdikt-frontend-weld.vercel.app,http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001}")
    private List<String> allowedOrigins;

    /** The single CORS policy (the duplicate in WebMvcConfig was removed) */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(allowedOrigins.stream().map(String::trim).filter(o -> !o.isEmpty()).toList());
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-Requested-With", "Accept"));
        configuration.setExposedHeaders(List.of("Retry-After"));
        // Auth is a bearer token in a header, never a cookie, so browsers never need to send credentials
        configuration.setAllowCredentials(false);
        configuration.setMaxAge(3600L); // Cache preflight response for 1 hour

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    private static void writeError(HttpServletResponse response, HttpStatus status, String message) throws IOException {
        response.setStatus(status.value());
        response.setContentType("application/json");
        response.getWriter().write("{\"status\":" + status.value() + ",\"code\":" + status.value()
                + ",\"error\":\"" + status.getReasonPhrase() + "\",\"message\":\"" + message + "\"}");
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authenticationConfiguration) throws Exception {
        return authenticationConfiguration.getAuthenticationManager();
    }
}