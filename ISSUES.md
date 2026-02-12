# Known Issues & Bug Tracking

## 🟠 Active Visual Tuning Notes (2026-02-12)

1. **Night sky realism still needs work**
   Current sky-cycle night stars and Milky Way band structure are improved but still not convincingly realistic.
   We need another tuning pass on cloud density, dust-lane contrast, and star distribution so the night phase reads more like a natural sky.

2. **Boid color transition is too abrupt across day/night**
   Prey/predator color changes during sky-cycle day/night state switches are currently stark and near-instant.
   We should interpolate color/emissive over time (smooth blend) instead of hard threshold switching.
