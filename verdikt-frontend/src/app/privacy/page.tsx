import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/site";
import { Callout, H2, H3, LegalPage, List } from "@/components/legal/Legal";

export const metadata: Metadata = {
  title: `Privacy Policy · ${SITE.name}`,
  description: `What ${SITE.name} collects, why, and the choices you have.`,
};

// Original template text matching what the app stores today. Update it whenever data handling changes,
// and have it reviewed by a lawyer before relying on it.
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated={SITE.lastUpdated.privacy}>
      <H2>Introduction</H2>
      <p>
        {SITE.legalName} (&ldquo;we&rdquo;, &ldquo;us&rdquo; or &ldquo;our&rdquo;) operates the {SITE.name} website (the
        &ldquo;Platform&rdquo;). This policy explains what information we collect when you use the Platform, how we use
        it, and the choices you have. By using the Platform, you agree to this policy and to our{" "}
        <Link href="/terms">Terms of Service</Link>.
      </p>

      <H2>Information We Collect</H2>
      <H3>Account information</H3>
      <List>
        <li>
          <strong>Username and email address</strong>, used to identify your account, sign you in and contact you about
          it.
        </li>
        <li>
          <strong>Password</strong>, stored only as a one-way hash. We never store or see your password in plain text.
        </li>
        <li>
          <strong>Avatar</strong>: a generated image created from your username by the DiceBear avatar service.
        </li>
      </List>
      <H3>Activity and content</H3>
      <List>
        <li>Your verdicts, reviews and comments, and whether a review contains spoilers or allows comments.</li>
        <li>Likes you give to reviews.</li>
        <li>Titles you mark as watched or save to watch later, and the collections you create.</li>
      </List>
      <H3>Sign-in storage</H3>
      <p>
        When you sign in, we keep a sign-in token and your basic profile in your browser&apos;s local storage so you stay
        signed in. Signing out removes them. We do not use advertising or cross-site tracking cookies.
      </p>

      <H2>How We Use Your Information</H2>
      <List>
        <li>to create and run your account and keep it secure;</li>
        <li>to show your reviews, verdicts, likes and comments to other members;</li>
        <li>to keep your watch history, watch-later list and collections;</li>
        <li>to respond to support requests;</li>
        <li>to enforce our Terms, prevent abuse and keep the Platform working;</li>
        <li>to meet our legal obligations.</li>
      </List>
      <p>We do not sell your personal information.</p>

      <H2>What Other Members Can See</H2>
      <p>
        Your username, avatar, reviews, verdicts and comments are public on the Platform, including to visitors who are
        not signed in. Like counts are public, but the names of people who liked a review are not. Your email address, watch history,
        watch-later list and collections are not shown to other members.
      </p>

      <H2>Deleting Content and Your Account</H2>
      <List>
        <li>
          Deleting a review removes it from our database, together with its likes and comments. Marking a title as not
          watched also deletes your review of it.
        </li>
        <li>
          You can delete your account at any time from Settings → Delete Account. This immediately and permanently
          deletes your profile, reviews, comments, likes, collections and watch history. If you can&apos;t sign in,
          email <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a> from the address on your account and
          we will delete it for you.
        </li>
      </List>
      <Callout title="Before you share a review card">
        <p>
          Share cards and links you send outside the Platform leave our control. Deleting the review later does not
          remove copies you or others have already shared.
        </p>
      </Callout>

      <H2>Third-Party Services</H2>
      <p>The Platform relies on these services to work:</p>
      <List>
        <li>
          <strong>TMDB, Google Books, Open Library, OMDb and game databases</strong> provide title information, images
          and ratings. Your browser loads posters and artwork directly from their servers, which can see your IP address
          like any website you visit.
        </li>
        <li>
          <strong>DiceBear</strong> generates avatars from usernames.
        </li>
        <li>
          <strong>YouTube</strong> and streaming services open only when you choose to follow a trailer or
          &ldquo;where to watch&rdquo; link. Their own privacy policies apply there.
        </li>
        <li>
          <strong>Hosting providers</strong> run our servers and database and process data on our behalf.
        </li>
      </List>

      <H2>Data Security</H2>
      <p>
        We use reasonable technical and organisational measures to protect your information, including hashed passwords
        and access controls on our systems. No method of transmission or storage is completely secure, so we cannot
        guarantee absolute security.
      </p>

      <H2>Your Rights</H2>
      <p>Under applicable Indian data protection law, including the Digital Personal Data Protection Act, 2023, you can:</p>
      <List>
        <li>
          <strong>access</strong> the personal data we hold about you;
        </li>
        <li>
          <strong>correct</strong> inaccurate or incomplete data;
        </li>
        <li>
          <strong>erase</strong> your data, subject to legal requirements;
        </li>
        <li>
          <strong>withdraw consent</strong> by deleting your account;
        </li>
        <li>
          <strong>raise a grievance</strong> with us and, if it is not resolved, with the Data Protection Board of India.
        </li>
      </List>
      <p>
        To use any of these rights, email <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>.
      </p>

      <H2>Children</H2>
      <p>
        The Platform is not intended for anyone under 18 without the consent of a parent or legal guardian. If you
        believe a child has given us personal data without that consent, contact us and we will delete it.
      </p>

      <H2>Changes to This Policy</H2>
      <p>
        We may update this policy as the Platform changes. We will update the date at the top of this page, and for
        significant changes we will make reasonable efforts to let members know.
      </p>

      <H2>Contact</H2>
      <Callout>
        <p>Questions or requests about your data? Contact us:</p>
        <p>
          <strong>{SITE.legalName}</strong>
          <br />
          Email: <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>
        </p>
      </Callout>
    </LegalPage>
  );
}
