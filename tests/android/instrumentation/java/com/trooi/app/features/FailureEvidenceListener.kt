package com.trooi.app.features

import android.util.Log
import org.junit.runner.Description
import org.junit.runner.notification.Failure
import org.junit.runner.notification.RunListener

/** Registered via testInstrumentationRunnerArguments listener=… */
class FailureEvidenceListener : RunListener() {
    override fun testFailure(failure: Failure) {
        val name = failure.description?.displayName ?: "unknown"
        Log.e("TroOiFailureEvidence", "capturing for $name: ${failure.message}")
        runCatching { FailureEvidenceCapture.dump(name) }
            .onFailure { Log.e("TroOiFailureEvidence", "dump failed", it) }
    }

    override fun testAssumptionFailure(failure: Failure) {
        testFailure(failure)
    }
}
