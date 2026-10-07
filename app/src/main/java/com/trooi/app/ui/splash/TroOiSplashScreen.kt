package com.trooi.app.ui.splash

import android.provider.Settings
import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.trooi.app.features.auth.AuthWelcomeActions
import com.trooi.app.features.auth.AuthWelcomeContent
import com.trooi.app.ui.theme.*
import kotlinx.coroutines.delay
import kotlin.math.sqrt

/**
 * Phase configuration for the first entry brand assembly animation.
 */
object SplashTiming {
    const val PHASE_A_SCATTER_MS = 150
    const val INDIVIDUAL_FLIGHT_MS = 560
    const val CONVERGENCE_DURATION_MS = 800
    const val BRAND_HOLD_MS = 650
    const val AUTH_TRANSITION_MS = 450
    const val TOTAL_SPLASH_TARGET_MS = 2000

    // Stagger delays for each component arriving from distinct directions (ms)
    const val DELAY_T = 0
    const val DELAY_R = 60
    const val DELAY_Ọ = 120
    const val DELAY_Ơ = 170
    const val DELAY_I = 220
    const val DELAY_SMILE = 270
}

/**
 * Directional off-screen origin configuration for each logo component.
 * Each arrives from a distinct boundary of the device viewport.
 */
data class ComponentVector(
    val relStartX: Float, // relative to screen width (-1.0 = left, +1.0 = right)
    val relStartY: Float, // relative to screen height (-1.0 = top, +1.0 = bottom)
    val delayMs: Int,
    val durationMs: Int = SplashTiming.INDIVIDUAL_FLIGHT_MS,
)

val BRAND_VECTORS = mapOf(
    "T" to ComponentVector(relStartX = -0.90f, relStartY = -0.45f, delayMs = SplashTiming.DELAY_T),
    "R" to ComponentVector(relStartX = -0.75f, relStartY = 0.50f, delayMs = SplashTiming.DELAY_R),
    "Ọ" to ComponentVector(relStartX = -0.20f, relStartY = 0.85f, delayMs = SplashTiming.DELAY_Ọ),
    "Ơ" to ComponentVector(relStartX = 0.70f, relStartY = -0.60f, delayMs = SplashTiming.DELAY_Ơ),
    "I" to ComponentVector(relStartX = 0.90f, relStartY = 0.35f, delayMs = SplashTiming.DELAY_I),
    "SMILE" to ComponentVector(relStartX = 0.15f, relStartY = 0.90f, delayMs = SplashTiming.DELAY_SMILE),
)

/**
 * Result of the motion streak math calculation.
 */
data class StreakResult(
    val tailOffset: Offset,
    val streakAlpha: Float,
    val trailLength: Float,
)

/**
 * Mathematically sound unit-vector motion streak calculation.
 * Produces a controlled, short, local trail that collapses cleanly near arrival.
 */
fun calculateStreak(
    currentX: Float,
    currentY: Float,
    originX: Float,
    originY: Float,
    velocity: Float,
    remainingRatio: Float,
    maxTrailLengthPx: Float = 36f,
): StreakResult {
    val dx = originX
    val dy = originY
    val distance = sqrt(dx * dx + dy * dy)

    if (distance < 0.001f || velocity <= 0.05f || remainingRatio <= 0.02f) {
        return StreakResult(
            tailOffset = Offset(currentX, currentY),
            streakAlpha = 0f,
            trailLength = 0f,
        )
    }

    // Normalized unit vector pointing backwards towards origin
    val unitX = dx / distance
    val unitY = dy / distance

    // Trail length is controlled, short, and local (max maxTrailLengthPx, e.g. ~36px)
    val controlledLength = (maxTrailLengthPx * velocity * remainingRatio.coerceIn(0f, 1f))
        .coerceIn(0f, maxTrailLengthPx)

    // Tail extends behind current position along the unit vector
    val tailX = currentX + unitX * controlledLength
    val tailY = currentY + unitY * controlledLength

    val alpha = (velocity * 0.35f * remainingRatio).coerceIn(0f, 0.40f)

    return StreakResult(
        tailOffset = Offset(tailX, tailY),
        streakAlpha = alpha,
        trailLength = controlledLength,
    )
}

/**
 * Computes individual progress (0.0 to 1.0) given the master convergence progress.
 */
fun calculateComponentProgress(
    totalProgress: Float,
    delayMs: Int,
    durationMs: Int = SplashTiming.INDIVIDUAL_FLIGHT_MS,
    totalDurationMs: Int = SplashTiming.CONVERGENCE_DURATION_MS,
): Float {
    if (totalProgress >= 1.0f) return 1.0f
    val currentMs = totalProgress * totalDurationMs
    if (currentMs < delayMs) return 0.0f
    val elapsedMs = currentMs - delayMs
    return (elapsedMs / durationMs).coerceIn(0.0f, 1.0f)
}

/**
 * The Brand Assembly animation:
 * Scattered pieces (T, r, ọ, Ơ, i, smile curve) arrive from different screen edges,
 * accelerate and emit subtle "hóa tia" motion streaks, decelerate smoothly,
 * and snap cleanly into the TrọƠi logo.
 */
@Composable
fun TroOiBrandAssembly(
    modifier: Modifier = Modifier,
    playProgress: Float, // 0.0f to 1.0f (0 = scatter, 1 = assembled & settled)
    authProgress: Float = 0.0f, // 0.0f = centered, 1.0f = translated to auth header
    containerWidthPx: Float,
    containerHeightPx: Float,
    isDark: Boolean = false,
) {
    val troColor = if (isDark) TroOiDarkInk else Color(0xFF16342D)
    val oiColor = if (isDark) TroOiDarkPrimary else Color(0xFF235A46)

    // Smooth convergence easing: fast acceleration in early phase, smooth deceleration near arrival
    val convergenceEasing = remember { CubicBezierEasing(0.16f, 1.0f, 0.30f, 1.0f) }

    // Overall vertical lift during Auth transition (Phase E)
    val density = LocalDensity.current
    val authTranslateY = with(density) { (-60.dp).toPx() * authProgress }
    val authScale = 1.0f

    Box(
        modifier = modifier
            .fillMaxSize()
            .graphicsLayer {
                translationY = authTranslateY
                scaleX = authScale
                scaleY = authScale
            },
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            // 1. Wordmark Row: "TrọƠi"
            Row(
                verticalAlignment = Alignment.Bottom,
                horizontalArrangement = Arrangement.Center,
            ) {
                // "T"
                val tVec = BRAND_VECTORS["T"]!!
                val tP = calculateComponentProgress(playProgress, tVec.delayMs, tVec.durationMs)
                val tEased = convergenceEasing.transform(tP)
                AnimatedLetterSlot(
                    letter = "T",
                    color = troColor,
                    vector = tVec,
                    eased = tEased,
                    velocity = (1f - tEased) * (if (tP in 0.05f..0.85f) 1f else 0.2f),
                    containerWidthPx = containerWidthPx,
                    containerHeightPx = containerHeightPx,
                )

                // "r"
                val rVec = BRAND_VECTORS["R"]!!
                val rP = calculateComponentProgress(playProgress, rVec.delayMs, rVec.durationMs)
                val rEased = convergenceEasing.transform(rP)
                AnimatedLetterSlot(
                    letter = "r",
                    color = troColor,
                    vector = rVec,
                    eased = rEased,
                    velocity = (1f - rEased) * (if (rP in 0.05f..0.85f) 1f else 0.2f),
                    containerWidthPx = containerWidthPx,
                    containerHeightPx = containerHeightPx,
                )

                // "ọ"
                val oVec = BRAND_VECTORS["Ọ"]!!
                val oP = calculateComponentProgress(playProgress, oVec.delayMs, oVec.durationMs)
                val oEased = convergenceEasing.transform(oP)
                AnimatedLetterSlot(
                    letter = "ọ",
                    color = troColor,
                    vector = oVec,
                    eased = oEased,
                    velocity = (1f - oEased) * (if (oP in 0.05f..0.85f) 1f else 0.2f),
                    containerWidthPx = containerWidthPx,
                    containerHeightPx = containerHeightPx,
                )

                // "Ơ"
                val oHornVec = BRAND_VECTORS["Ơ"]!!
                val oHornP = calculateComponentProgress(playProgress, oHornVec.delayMs, oHornVec.durationMs)
                val oHornEased = convergenceEasing.transform(oHornP)
                AnimatedLetterSlot(
                    letter = "Ơ",
                    color = oiColor,
                    vector = oHornVec,
                    eased = oHornEased,
                    velocity = (1f - oHornEased) * (if (oHornP in 0.05f..0.85f) 1f else 0.2f),
                    containerWidthPx = containerWidthPx,
                    containerHeightPx = containerHeightPx,
                )

                // "i"
                val iVec = BRAND_VECTORS["I"]!!
                val iP = calculateComponentProgress(playProgress, iVec.delayMs, iVec.durationMs)
                val iEased = convergenceEasing.transform(iP)
                AnimatedLetterSlot(
                    letter = "i",
                    color = oiColor,
                    vector = iVec,
                    eased = iEased,
                    velocity = (1f - iEased) * (if (iP in 0.05f..0.85f) 1f else 0.2f),
                    containerWidthPx = containerWidthPx,
                    containerHeightPx = containerHeightPx,
                )
            }

            // 2. Brand Smile Accent Curve Underneath
            val smileVec = BRAND_VECTORS["SMILE"]!!
            val smileP = calculateComponentProgress(playProgress, smileVec.delayMs, smileVec.durationMs)
            val smileEased = convergenceEasing.transform(smileP)
            val smileVelocity = (1f - smileEased) * (if (smileP in 0.05f..0.85f) 1f else 0.2f)

            Spacer(Modifier.height(4.dp))
            AnimatedSmileSlot(
                color = oiColor,
                vector = smileVec,
                eased = smileEased,
                velocity = smileVelocity,
                containerWidthPx = containerWidthPx,
                containerHeightPx = containerHeightPx,
            )

            // 3. Brand Tagline (fades in quietly during Brand Hold phase)
            val taglineAlpha = if (playProgress >= 0.88f) {
                ((playProgress - 0.88f) / 0.12f).coerceIn(0f, 1f)
            } else 0f

            Spacer(Modifier.height(18.dp))
            Text(
                text = "Thuê trọ rõ ràng\n· Vận hành an tâm",
                style = MaterialTheme.typography.bodyLarge.copy(
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Medium,
                    lineHeight = 24.sp,
                ),
                color = if (isDark) TroOiDarkMuted else TroOiMuted,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                modifier = Modifier.alpha(taglineAlpha),
            )
        }
    }
}

/**
 * Renders an animated letter with high-velocity motion streaks ("hóa tia").
 */
@Composable
private fun AnimatedLetterSlot(
    letter: String,
    color: Color,
    vector: ComponentVector,
    eased: Float,
    velocity: Float,
    containerWidthPx: Float,
    containerHeightPx: Float,
) {
    val startX = vector.relStartX * containerWidthPx
    val startY = vector.relStartY * containerHeightPx

    // Main component offset
    val curX = (1f - eased) * startX
    val curY = (1f - eased) * startY

    // Micro settling overshoot at the very end
    val settleScale = if (eased > 0.94f) {
        val p = (eased - 0.94f) / 0.06f
        1.0f + 0.035f * (1f - p)
    } else 1.0f

    // Motion stretching factor along velocity vector
    val stretchX = 1.0f + (0.16f * velocity)
    val stretchY = 1.0f - (0.06f * velocity)

    // Ghost trail sample 1 (close trail)
    val ghost1P = (eased - 0.045f).coerceAtLeast(0f)
    val ghost1X = (1f - ghost1P) * startX
    val ghost1Y = (1f - ghost1P) * startY
    val ghost1Alpha = (0.34f * velocity).coerceIn(0f, 0.45f)

    // Ghost trail sample 2 (far trail)
    val ghost2P = (eased - 0.09f).coerceAtLeast(0f)
    val ghost2X = (1f - ghost2P) * startX
    val ghost2Y = (1f - ghost2P) * startY
    val ghost2Alpha = (0.16f * velocity).coerceIn(0f, 0.25f)

    val streak = calculateStreak(
        currentX = curX,
        currentY = curY,
        originX = startX,
        originY = startY,
        velocity = velocity,
        remainingRatio = 1f - eased,
        maxTrailLengthPx = 36f,
    )

    Box(
        modifier = Modifier
            .drawBehind {
                if (streak.streakAlpha > 0.01f && streak.trailLength > 1f) {
                    val brush = Brush.linearGradient(
                        colors = listOf(
                            color.copy(alpha = streak.streakAlpha),
                            color.copy(alpha = 0f),
                        ),
                        start = Offset(size.width / 2f, size.height / 2f),
                        end = Offset(
                            size.width / 2f + (streak.tailOffset.x - curX),
                            size.height / 2f + (streak.tailOffset.y - curY),
                        ),
                    )
                    drawLine(
                        brush = brush,
                        start = Offset(size.width / 2f, size.height / 2f),
                        end = Offset(
                            size.width / 2f + (streak.tailOffset.x - curX),
                            size.height / 2f + (streak.tailOffset.y - curY),
                        ),
                        strokeWidth = 3.dp.toPx(),
                        cap = StrokeCap.Round,
                    )
                }
            },
        contentAlignment = Alignment.Center,
    ) {
        // Ghost trail 2 (furthest, faintest)
        if (ghost2Alpha > 0.02f) {
            Text(
                text = letter,
                style = MaterialTheme.typography.displayMedium.copy(
                    fontSize = 56.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.SansSerif,
                    letterSpacing = (-0.6).sp,
                ),
                color = color.copy(alpha = ghost2Alpha),
                modifier = Modifier.graphicsLayer {
                    translationX = ghost2X
                    translationY = ghost2Y
                    scaleX = 0.94f
                    scaleY = 0.94f
                },
            )
        }

        // Ghost trail 1 (mid trail)
        if (ghost1Alpha > 0.02f) {
            Text(
                text = letter,
                style = MaterialTheme.typography.displayMedium.copy(
                    fontSize = 56.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.SansSerif,
                    letterSpacing = (-0.6).sp,
                ),
                color = color.copy(alpha = ghost1Alpha),
                modifier = Modifier.graphicsLayer {
                    translationX = ghost1X
                    translationY = ghost1Y
                    scaleX = 0.97f
                    scaleY = 0.97f
                },
            )
        }

        // Main primary letterform
        Text(
            text = letter,
            style = MaterialTheme.typography.displayMedium.copy(
                fontSize = 56.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.SansSerif,
                letterSpacing = (-0.6).sp,
            ),
            color = color,
            modifier = Modifier
                .graphicsLayer {
                    translationX = curX
                    translationY = curY
                    scaleX = settleScale * stretchX
                    scaleY = settleScale * stretchY
                    alpha = (0.2f + 0.8f * eased).coerceIn(0f, 1f)
                }
                .semantics { testTag = "Letter_$letter" },
        )
    }
}

/**
 * Renders the animated brand smile/accent curve underneath the wordmark.
 */
@Composable
private fun AnimatedSmileSlot(
    color: Color,
    vector: ComponentVector,
    eased: Float,
    velocity: Float,
    containerWidthPx: Float,
    containerHeightPx: Float,
) {
    val startX = vector.relStartX * containerWidthPx
    val startY = vector.relStartY * containerHeightPx

    val curX = (1f - eased) * startX
    val curY = (1f - eased) * startY

    val settleScale = if (eased > 0.94f) {
        val p = (eased - 0.94f) / 0.06f
        1.0f + 0.035f * (1f - p)
    } else 1.0f

    val streak = calculateStreak(
        currentX = curX,
        currentY = curY,
        originX = startX,
        originY = startY,
        velocity = velocity,
        remainingRatio = 1f - eased,
        maxTrailLengthPx = 30f,
    )

    Box(
        modifier = Modifier
            .drawBehind {
                if (streak.streakAlpha > 0.01f && streak.trailLength > 1f) {
                    val brush = Brush.linearGradient(
                        colors = listOf(
                            color.copy(alpha = streak.streakAlpha),
                            color.copy(alpha = 0f),
                        ),
                        start = Offset(size.width / 2f, size.height / 2f),
                        end = Offset(
                            size.width / 2f + (streak.tailOffset.x - curX),
                            size.height / 2f + (streak.tailOffset.y - curY),
                        ),
                    )
                    drawLine(
                        brush = brush,
                        start = Offset(size.width / 2f, size.height / 2f),
                        end = Offset(
                            size.width / 2f + (streak.tailOffset.x - curX),
                            size.height / 2f + (streak.tailOffset.y - curY),
                        ),
                        strokeWidth = 2.dp.toPx(),
                        cap = StrokeCap.Round,
                    )
                }
            }
            .graphicsLayer {
                translationX = curX
                translationY = curY
                scaleX = settleScale
                scaleY = settleScale
                alpha = (0.2f + 0.8f * eased).coerceIn(0f, 1f)
            }
            .size(width = 52.dp, height = 8.dp)
            .semantics { testTag = "BrandSmile" },
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val smilePath = Path().apply {
                moveTo(2f, 1f)
                quadraticTo(size.width / 2f, size.height + 2f, size.width - 2f, 1f)
            }
            drawPath(
                path = smilePath,
                color = color,
                style = Stroke(width = 4.0.dp.toPx(), cap = StrokeCap.Round),
            )
        }
    }
}

/**
 * Routing actions for splash / session orchestration handoff.
 */
enum class SplashHandoffAction {
    HOLD,
    AUTHENTICATED,
    AUTH,
}

/**
 * Pure presentation decision helper for race-free splash handoff.
 */
fun evaluateSplashHandoff(
    brandAnimationReady: Boolean,
    sessionRestoring: Boolean,
    isAuthenticated: Boolean,
): SplashHandoffAction {
    if (!brandAnimationReady) return SplashHandoffAction.HOLD
    if (sessionRestoring) return SplashHandoffAction.HOLD
    return if (isAuthenticated) {
        SplashHandoffAction.AUTHENTICATED
    } else {
        SplashHandoffAction.AUTH
    }
}

/**
 * Top-level Orchestrator for the TrọƠi First Entry Experience:
 * - Brand Assembly animation runs in parallel with session restoration
 * - Never cut mid-flight if session restores early
 * - If session is still restoring after brand animation, holds assembled logo calmly
 * - Reactively triggers handoff as soon as brand animation is ready and session is resolved:
 *     - If authenticated -> seamless route to authenticated destination
 *     - If unauthenticated -> continuous transition to unified Auth Welcome
 */
@Composable
fun TroOiFirstEntryScreen(
    onSignInWithGoogle: () -> Unit,
    onLoginClick: () -> Unit,
    onSignUpClick: () -> Unit,
    authInProgress: Boolean = false,
    googleBacked: Boolean = false,
    sessionRestoring: Boolean = false,
    isAuthenticated: Boolean = false,
    onCompleteTransition: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val configuration = LocalConfiguration.current
    val density = LocalDensity.current
    val isDark = isSystemInDarkTheme()

    val screenWidthPx = with(density) { configuration.screenWidthDp.dp.toPx() }
    val screenHeightPx = with(density) { configuration.screenHeightDp.dp.toPx() }

    val context = LocalContext.current
    val isReducedMotion = remember(context) {
        try {
            val durationScale = Settings.Global.getFloat(
                context.contentResolver,
                Settings.Global.ANIMATOR_DURATION_SCALE,
                1.0f,
            )
            val transitionScale = Settings.Global.getFloat(
                context.contentResolver,
                Settings.Global.TRANSITION_ANIMATION_SCALE,
                1.0f,
            )
            durationScale == 0f || transitionScale == 0f
        } catch (_: Throwable) {
            false
        }
    }

    val playProgress = remember { Animatable(0f) }
    val authProgress = remember { Animatable(0f) }
    var brandAnimationReady by remember { mutableStateOf(false) }

    // Intro brand animation lifecycle: executes minimum brand presentation then signals readiness
    LaunchedEffect(Unit) {
        if (isReducedMotion) {
            playProgress.snapTo(1f)
            delay(SplashTiming.BRAND_HOLD_MS.toLong())
            brandAnimationReady = true
        } else {
            playProgress.animateTo(
                targetValue = 1f,
                animationSpec = tween(
                    durationMillis = SplashTiming.CONVERGENCE_DURATION_MS,
                    easing = LinearEasing,
                ),
            )
            delay(SplashTiming.BRAND_HOLD_MS.toLong())
            brandAnimationReady = true
        }
    }

    // Reactive handoff decision: triggered whenever animation readiness or session state changes
    LaunchedEffect(brandAnimationReady, sessionRestoring, isAuthenticated) {
        when (evaluateSplashHandoff(brandAnimationReady, sessionRestoring, isAuthenticated)) {
            SplashHandoffAction.HOLD -> {
                // Hold assembled presentation calmly
            }
            SplashHandoffAction.AUTHENTICATED -> {
                onCompleteTransition()
            }
            SplashHandoffAction.AUTH -> {
                authProgress.animateTo(
                    targetValue = 1f,
                    animationSpec = tween(
                        durationMillis = SplashTiming.AUTH_TRANSITION_MS,
                        easing = CubicBezierEasing(0.2f, 0.0f, 0.0f, 1.0f),
                    ),
                )
            }
        }
    }

    // Warm background
    val bgColor = if (isDark) TroOiDarkCanvas else Color(0xFFFFFDF8)

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(bgColor),
    ) {
        // Continuous Brand Assembly / Wordmark
        TroOiBrandAssembly(
            playProgress = playProgress.value,
            authProgress = authProgress.value,
            containerWidthPx = screenWidthPx,
            containerHeightPx = screenHeightPx,
            isDark = isDark,
        )

        // Slide-up Auth Options (Unified with AuthWelcomeScreen)
        if (authProgress.value > 0.01f) {
            val authAlpha = (authProgress.value * 1.3f).coerceIn(0f, 1f)
            val authSlideY = with(density) { (40.dp * (1f - authProgress.value)).toPx() }

            Box(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp)
                    .padding(bottom = 36.dp)
                    .graphicsLayer {
                        translationY = authSlideY
                        alpha = authAlpha
                    },
            ) {
                AuthWelcomeActions(
                    onLogin = onLoginClick,
                    onSignUp = onSignUpClick,
                    onSignInWithGoogle = onSignInWithGoogle,
                    authInProgress = authInProgress,
                )
            }
        }
    }
}
