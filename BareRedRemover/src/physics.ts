/*
    THE ORIGINAL (Box2D 2.0 FOR FLASH) RAN AT 40 FPS AND STEPPED THE WORLD BY 0.8 / 30 SECONDS PER FRAME,
    WITH 30 PIXELS PER METER. SO 1 REAL SECOND IS 40 * 0.8 / 30 = 1.0667 SIMULATED SECONDS.
    SOPIRO WORKS IN PIXELS AND REAL SECONDS, SO EVERY VALUE BELOW IS CONVERTED:
        speed:        m/s   -> * 30 * 1.0667     = * 32 px/s
        acceleration: m/s^2 -> * 30 * 1.0667^2   = * 34.13 px/s^2
*/
const SIM_PER_REAL = 40 * 0.8 / 30;
const PX_PER_M = 30;

export const SPEED_SCALE = PX_PER_M * SIM_PER_REAL;

// ApplyForce(mass * 10) EVERY STEP = 10 m/s^2. SET AS "gravity" IN settingsData.json (341.33)
export const GRAVITY = 10 * PX_PER_M * SIM_PER_REAL * SIM_PER_REAL;

// FACE FRAMES 1-4 BELOW THESE SPEEDS (|vx| + |vy|), ORIGINALLY 0.2, 1, 4 AND 20 m/s
export const FACE_SPEEDS = [0.2, 1, 4, 20].map(v => v * SPEED_SCALE);

// A BODY COUNTS AS STABLE BELOW THIS SPEED, ORIGINALLY 0.001 m/s
export const STABLE_SPEED = 0.001 * SPEED_SCALE;

// SHAPES ARE REMOVED WHEN THEIR CENTER LEAVES THIS AREA, A GREEN ONE FAILS THE LEVEL
export const BOUNDS = { left: -500, top: -500, right: 800, bottom: 800 };

// WIN CHECK: AFTER 3 SECONDS, WITH ALL RED GONE AND EVERYTHING STILL, THE ORIGINAL STARTS A COUNTDOWN.
// IT PASSES AFTER 30 STILL FRAMES, OR AFTER 358 / 1.5 FRAMES NO MATTER WHAT. AT 40 FPS:
export const MIN_LEVEL_TIME = 3;
export const STILL_TIME_TO_PASS = 30 / 40;
export const CHECK_TIME_LIMIT = 358 / 1.5 / 40;

/*
    THE SOLVER SETTINGS ARE IN settingsData.json, UNDER "sopiro", CONVERTED FROM Box2D 2.0 THE SAME WAY:
        numIterations         15         m_iterations
        penetrationSlop       0.15       b2_linearSlop 0.005 m
        restitutionThreshold  32         b2_velocityThreshold: NO BOUNCE BELOW 1 m/s
        sleepingWait          0.46875    b2_timeToSleep 0.5 s
        restLinearTolerance   0.1024     b2_linearSleepTolerance 0.01 m/s, SQUARED
        restAngularTolerance  0.0013863  b2_angularSleepTolerance 2 deg/s, SQUARED

    EVERY ORIGINAL SHAPE HAS friction 0.5, restitution 0.2 AND density 1. SOPIRO MIXES THEM LIKE Box2D
    (sqrt(fA * fB) AND max(rA, rB)), SO THE PREFABS USE THOSE VALUES AS THEY ARE.
*/
