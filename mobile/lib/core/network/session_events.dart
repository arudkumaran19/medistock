/// SHARED CORE - not owned by the Demand vertical.
///
/// Placeholder created by Sathurstiga S. (IT24103156). The mobile core owners replace
/// this on integration.
///
/// Lets the network layer report a rejected token back to the session layer without
/// core having to depend on a feature package, which would otherwise create a circular
/// dependency between the API client and the auth providers.
class SessionEvents {
  const SessionEvents._();

  /// Set once by the session controller at construction.
  static Future<void> Function()? onUnauthorized;
}
