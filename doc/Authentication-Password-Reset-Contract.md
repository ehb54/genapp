# Authentication Password Reset Contract

The HTML5 system-login handlers provide the password-reset contract for GenApp
applications. It applies equally to ordinary, Globus, and Google login
templates when the account uses a local password.

## Invariants

- A reset request must not replace or expire the current password.
- Reset credentials use `random_bytes()` and are stored only as a password hash.
- A pending reset records its hash, expiry, request time, and request IP in the
  user record. The expiry is one hour after creation.
- An explicit mail-submission failure removes the matching pending reset. A
  mail transport accepting a message for later delivery never invalidates the
  current password.
- The current password remains valid while a reset is pending. A successful
  current-password login cancels the pending reset.
- An unexpired pending credential may authenticate once. That login promotes
  its hash into the existing one-use password flow, removes the pending-reset
  fields, clears failed-login state, and requires the user to change password.
- Expired pending credentials do not authenticate.
- After UI2 receives an accepted reset response, it must return the login form
  to ordinary-login mode before the next submission: clear the reset control
  and password, preserve the user id, and focus the password field.

## Compatibility and testing

The existing login request shape, status keys, user-record password hash, and
Settings password-change flow remain unchanged. Do not add application-specific
reset paths or a second account store. Maintain executable coverage for failed
mail, accepted mail, permanent-password cancellation, pending-credential
promotion, expiry, the three login-template variants, and the UI2 reset-to-login
transition.
