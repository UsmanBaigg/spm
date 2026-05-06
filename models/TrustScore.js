export default class TrustScore {
  static find() {}
  static findById() {}
  static findOne() {}
  save() {}
  static determineBadge(score) {
    if (score >= 95) return 'community-star';
    if (score >= 80) return 'verified-contributor';
    if (score >= 60) return 'trusted-neighbor';
    if (score >= 31) return 'community-member';
    return 'new-neighbor';
  }
}
