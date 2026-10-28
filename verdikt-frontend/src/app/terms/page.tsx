import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/site";
import { Callout, H2, H3, LegalPage, List } from "@/components/legal/Legal";

export const metadata: Metadata = {
  title: `Terms of Service · ${SITE.name}`,
  description: `The terms that apply when you use ${SITE.name}.`,
};

// Original template text describing how this app works. Have it reviewed by a lawyer before relying on it.
export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated={SITE.lastUpdated.terms}>
      <H2>1. Acceptance of Terms</H2>
      <p>
        {SITE.legalName} (&ldquo;we&rdquo;, &ldquo;us&rdquo; or &ldquo;our&rdquo;) operates the {SITE.name} website (the
        &ldquo;Platform&rdquo;). By creating an account or using the Platform, you agree to these Terms of Service
        (&ldquo;Terms&rdquo;) and to our <Link href="/privacy">Privacy Policy</Link>. If you do not agree, please do not use
        the Platform.
      </p>

      <H2>2. What the Platform Does</H2>
      <p>
        {SITE.name} helps you discover movies, series, anime, games and books, see where to watch or read them, and share
        verdicts (Skip, Timepass, Go For It or Perfection) and reviews with other members. You can also keep a watch
        history, a watch-later list and your own collections.
      </p>
      <p>
        We do not stream, sell or host any films, episodes, games or books. Links to streaming services take you to
        those services, which have their own terms.
      </p>

      <H2>3. Content and Intellectual Property</H2>
      <H3>3.1 Third-party information</H3>
      <p>
        Titles, posters, artwork, synopses, cast and crew information, release dates and ratings shown on the Platform
        come from third-party sources such as The Movie Database (TMDB), Google Books, Open Library, OMDb and game
        databases. They remain the property of their respective owners. We show them to identify a work and to support
        commentary, criticism and review, and we do not claim ownership of them.
      </p>
      <p>
        This product uses the TMDB API but is not endorsed or certified by TMDB.
      </p>
      <H3>3.2 Our materials</H3>
      <p>
        The {SITE.name} name, logo, design and software belong to us. You may not copy, modify or
        redistribute them except as the Platform allows (for example, sharing a review card you created).
      </p>
      <H3>3.3 Copyright concerns</H3>
      <p>
        If you believe something on the Platform infringes your rights, email{" "}
        <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a> with the page link and details of the work. We
        will review the request and remove material where appropriate.
      </p>

      <Callout title="We do not support piracy">
        <p>The Platform does not:</p>
        <List>
          <li>host, store or stream copyrighted films, shows, games or books;</li>
          <li>link to sites or tools that provide unauthorised copies;</li>
          <li>encourage or help anyone infringe copyright.</li>
        </List>
        <p>Please watch, play and read through theatres, official streaming services, stores and licensed distributors.</p>
      </Callout>

      <H2>4. Your Account</H2>
      <List>
        <li>Provide accurate details when you sign up, and keep your password private.</li>
        <li>You are responsible for activity on your account. Tell us promptly if you think someone else has used it.</li>
        <li>One person, one account. Accounts may not be sold or transferred.</li>
      </List>

      <H2>5. Community Conduct</H2>
      <p>When you use the Platform, you agree not to:</p>
      <List>
        <li>break the law, or help anyone else do so;</li>
        <li>post or link to pirated content, or explain how to obtain it;</li>
        <li>harass, threaten, impersonate or abuse others, or post hate speech;</li>
        <li>post spam, scams, or misleading or sexually explicit material;</li>
        <li>reveal major plot details without marking your review as containing spoilers;</li>
        <li>scrape the Platform, overload it, or try to get around its security.</li>
      </List>

      <H2>6. Reviews, Comments and Likes</H2>
      <H3>6.1 Your content</H3>
      <p>
        You keep ownership of the reviews and comments you post. By posting, you give us a non-exclusive,
        worldwide, royalty-free licence to host, display and share that content on and in connection with the Platform,
        including in share cards you choose to create. You confirm you have the right to post it.
      </p>
      <H3>6.2 Comments on your reviews</H3>
      <p>
        You can turn comments on or off for each review. Turning them off stops new comments; it does not remove
        comments already posted.
      </p>
      <H3>6.3 Removing content</H3>
      <p>
        You can edit or delete your own reviews at any time. Deleting a review also deletes its likes and comments.
        Marking a title as not watched deletes your review of it too.
      </p>
      <Callout title="Moderation">
        <p>
          We may remove content, or suspend or close accounts, that break these Terms or the law. Where reasonable, we
          will tell you why, but we may act without notice when needed to protect people or the Platform.
        </p>
      </Callout>

      <H2>7. Age Requirement</H2>
      <p>
        You must be at least 18 years old, or have the consent of a parent or legal guardian, to create an account.
      </p>

      <H2>8. Availability and Liability</H2>
      <p>
        The Platform is provided &ldquo;as is&rdquo;. Information from third-party sources, including ratings, release
        dates and where to watch, may be incomplete or out of date, and we do not guarantee that the Platform will
        always be available or error-free. To the extent the law allows, we are not liable for indirect or
        consequential loss arising from your use of the Platform.
      </p>

      <H2>9. Ending Your Use</H2>
      <p>
        You can stop using the Platform at any time and ask us to delete your account by emailing{" "}
        <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a> from the address on your account. We may suspend
        or end access for accounts that break these Terms.
      </p>

      <H2>10. Changes to These Terms</H2>
      <p>
        We may update these Terms as the Platform changes. We will update the date at the top of this page, and for
        significant changes we will make reasonable efforts to let members know. Continuing to use the Platform after a
        change means you accept the updated Terms.
      </p>

      <H2>11. Governing Law</H2>
      <p>
        These Terms are governed by the laws of India. Any dispute will be subject to the exclusive jurisdiction of the
        courts of India.
      </p>

      <H2>12. Contact</H2>
      <Callout>
        <p>Questions about these Terms? Contact us:</p>
        <p>
          <strong>{SITE.legalName}</strong>
          <br />
          Email: <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>
        </p>
      </Callout>
    </LegalPage>
  );
}
