package com.verdikt.api.service;

import com.verdikt.api.User;
import com.verdikt.api.UserAvatar;
import com.verdikt.api.dto.AuthResponse;
import com.verdikt.api.exception.BadRequestException;
import com.verdikt.api.exception.ConflictException;
import com.verdikt.api.exception.ResourceNotFoundException;
import com.verdikt.api.repository.CollectionItemRepository;
import com.verdikt.api.repository.MediaCollectionRepository;
import com.verdikt.api.repository.ReviewCommentRepository;
import com.verdikt.api.repository.ReviewLikeRepository;
import com.verdikt.api.repository.ReviewRepository;
import com.verdikt.api.repository.UserAvatarRepository;
import com.verdikt.api.repository.UserMediaStateRepository;
import com.verdikt.api.repository.UserRepository;
import com.verdikt.api.security.JwtTokenProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.net.URISyntaxException;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * The signed-in user's own profile: display name, bio, social links, avatar, username and account deletion.
 */
@Service
public class ProfileService {

    private static final Logger log = LoggerFactory.getLogger(ProfileService.class);

    private static final Pattern USERNAME = Pattern.compile("^[A-Za-z0-9._]{3,30}$");
    private static final int NAME_MAX = 50;
    private static final int BIO_MAX = 500;
    private static final int URL_MAX = 255;

    private static final Set<String> INSTAGRAM_HOSTS = Set.of("instagram.com", "www.instagram.com");
    private static final Set<String> X_HOSTS = Set.of("x.com", "www.x.com", "twitter.com", "www.twitter.com");
    private static final Set<String> YOUTUBE_HOSTS = Set.of("youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be");

    private final UserRepository userRepository;
    private final ReviewRepository reviewRepository;
    private final ReviewLikeRepository reviewLikeRepository;
    private final ReviewCommentRepository reviewCommentRepository;
    private final MediaCollectionRepository collectionRepository;
    private final CollectionItemRepository collectionItemRepository;
    private final UserMediaStateRepository userMediaStateRepository;
    private final UserAvatarRepository avatarRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;

    public ProfileService(UserRepository userRepository, ReviewRepository reviewRepository,
                          ReviewLikeRepository reviewLikeRepository, ReviewCommentRepository reviewCommentRepository,
                          MediaCollectionRepository collectionRepository, CollectionItemRepository collectionItemRepository,
                          UserMediaStateRepository userMediaStateRepository, UserAvatarRepository avatarRepository,
                          PasswordEncoder passwordEncoder,
                          JwtTokenProvider tokenProvider) {
        this.userRepository = userRepository;
        this.reviewRepository = reviewRepository;
        this.reviewLikeRepository = reviewLikeRepository;
        this.reviewCommentRepository = reviewCommentRepository;
        this.collectionRepository = collectionRepository;
        this.collectionItemRepository = collectionItemRepository;
        this.userMediaStateRepository = userMediaStateRepository;
        this.avatarRepository = avatarRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenProvider = tokenProvider;
    }

    /** Includes the email, so it is only ever returned to the account owner */
    public record MeResponse(UUID id, String username, String email, String avatarUrl, String firstName, String lastName,
                             String bio, String instagramUrl, String xUrl, String youtubeUrl, Instant createdAt) {
        static MeResponse of(User u) {
            return new MeResponse(u.getId(), u.getUsername(), u.getEmail(), u.getAvatarUrl(), u.getFirstName(),
                    u.getLastName(), u.getBio(), u.getInstagramUrl(), u.getXUrl(), u.getYoutubeUrl(), u.getCreatedAt());
        }
    }

    /** Every field is the full new value; blank clears it. avatarStyle/avatarSeed are optional (null keeps the avatar). */
    public record UpdateProfileRequest(String firstName, String lastName, String bio, String instagramUrl, String xUrl,
                                       String youtubeUrl, String avatarStyle, String avatarSeed) {
    }

    @Transactional(readOnly = true)
    public MeResponse getMe(String username) {
        return MeResponse.of(load(username));
    }

    @Transactional
    public MeResponse updateProfile(String username, UpdateProfileRequest req) {
        if (req == null) throw new BadRequestException("Nothing to save.");
        User user = load(username);
        user.setFirstName(text(req.firstName(), NAME_MAX, "First name"));
        user.setLastName(text(req.lastName(), NAME_MAX, "Last name"));
        user.setBio(text(req.bio(), BIO_MAX, "Bio"));
        user.setInstagramUrl(socialUrl(req.instagramUrl(), INSTAGRAM_HOSTS, "Instagram"));
        user.setXUrl(socialUrl(req.xUrl(), X_HOSTS, "X"));
        user.setYoutubeUrl(socialUrl(req.youtubeUrl(), YOUTUBE_HOSTS, "YouTube"));
        if (req.avatarStyle() != null) {
            String seed = req.avatarSeed() == null || req.avatarSeed().isBlank()
                    ? Avatars.seedFrom(user.getUsername())
                    : req.avatarSeed().trim();
            user.setAvatarUrl(Avatars.url(req.avatarStyle(), seed));
            // A generated avatar replaces an uploaded photo
            avatarRepository.deleteById(user.getId());
        }
        return MeResponse.of(user);
    }

    /** The JWT subject is the username, so a rename issues a fresh token and the old one stops working */
    @Transactional
    public AuthResponse changeUsername(String username, String requested) {
        String next = requested == null ? "" : requested.trim();
        if (!USERNAME.matcher(next).matches()) {
            throw new BadRequestException("Use 3 to 30 characters: letters, numbers, dots and underscores only.");
        }
        User user = load(username);
        if (next.equals(user.getUsername())) {
            throw new BadRequestException("That's already your username.");
        }
        // Case-only changes keep the same account; any other match belongs to someone else
        if (!next.equalsIgnoreCase(user.getUsername()) && userRepository.existsByUsername(next)) {
            throw new ConflictException("That username is already taken.");
        }
        user.setUsername(next);
        userRepository.saveAndFlush(user);
        return AuthResponse.builder()
                .token(tokenProvider.generateToken(next))
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .avatarUrl(user.getAvatarUrl())
                .build();
    }

    /** Permanently removes the account and everything tied to it, children first */
    @Transactional
    public void deleteAccount(String username, String password) {
        User user = load(username);
        if (password == null || !passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new BadRequestException("That password isn't right.");
        }
        UUID id = user.getId();
        reviewLikeRepository.deleteAllForUser(id);
        reviewCommentRepository.deleteAllForUser(id);
        reviewRepository.deleteAllByUserId(id);
        collectionItemRepository.deleteAllForUser(id);
        collectionRepository.deleteAllByUserId(id);
        userMediaStateRepository.deleteAllByUserId(id);
        avatarRepository.deleteById(id);
        userRepository.delete(user);
        log.info("Deleted account {}", id);
    }

    /** One-time move off the old cartoon avatars; accounts that picked a style keep it */
    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void replaceLegacyAvatars() {
        List<User> legacy = userRepository.findByAvatarUrlContaining("/avataaars/");
        legacy.forEach(u -> u.setAvatarUrl(Avatars.defaultFor(u.getUsername())));
        if (!legacy.isEmpty()) {
            userRepository.saveAll(legacy);
            log.info("Switched {} accounts to the minimal default avatar", legacy.size());
        }
    }

    /** Stores an uploaded photo (re-encoded by AvatarImages) and points the account at it */
    @Transactional
    public MeResponse uploadAvatar(String username, byte[] upload) {
        User user = load(username);
        byte[] image = AvatarImages.process(upload);
        Instant now = Instant.now();
        UserAvatar avatar = avatarRepository.findById(user.getId()).orElse(null);
        if (avatar == null) {
            avatarRepository.save(new UserAvatar(user.getId(), image, now));
        } else {
            avatar.setImage(image);
            avatar.setUpdatedAt(now);
        }
        // Same-origin path (the frontend proxies /avatars/* here); ?v= busts caches after every new upload
        user.setAvatarUrl("/avatars/" + user.getId() + "?v=" + now.toEpochMilli());
        return MeResponse.of(user);
    }

    /** Removes an uploaded photo and goes back to the default generated avatar */
    @Transactional
    public MeResponse removeAvatar(String username) {
        User user = load(username);
        avatarRepository.deleteById(user.getId());
        user.setAvatarUrl(Avatars.defaultFor(user.getUsername()));
        return MeResponse.of(user);
    }

    @Transactional(readOnly = true)
    public Optional<byte[]> avatarImage(UUID userId) {
        return avatarRepository.findById(userId).map(UserAvatar::getImage);
    }

    private User load(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("Account not found."));
    }

    private static String text(String value, int max, String label) {
        if (value == null) return null;
        // Drop control characters except newlines (the bio keeps its line breaks)
        String v = value.replaceAll("[\\p{Cntrl}&&[^\\n]]", "").trim();
        if (v.isEmpty()) return null;
        if (v.codePointCount(0, v.length()) > max) {
            throw new BadRequestException(label + " can be at most " + max + " characters.");
        }
        return v;
    }

    /** https only, on the platform's own hosts; "instagram.com/name" without a scheme is accepted */
    private static String socialUrl(String value, Set<String> hosts, String label) {
        if (value == null || value.isBlank()) return null;
        String v = value.trim();
        if (!v.contains("://")) v = "https://" + v;
        String error = "Enter a valid " + label + " link, like https://" + hosts.iterator().next() + "/yourname.";
        if (v.length() > URL_MAX) throw new BadRequestException(label + " link is too long.");
        try {
            URI uri = new URI(v);
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
            if (!(scheme.equals("https") || scheme.equals("http")) || !hosts.contains(host) || uri.getUserInfo() != null
                    || uri.getPort() != -1) {
                throw new BadRequestException(error);
            }
            String path = uri.getRawPath() == null ? "" : uri.getRawPath();
            if (path.isEmpty() || path.equals("/")) throw new BadRequestException(error);
            String query = uri.getRawQuery() == null ? "" : "?" + uri.getRawQuery();
            return "https://" + host + path + query;
        } catch (URISyntaxException e) {
            throw new BadRequestException(error);
        }
    }
}
