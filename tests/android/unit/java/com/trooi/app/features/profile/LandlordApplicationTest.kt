package com.trooi.app.features.profile

import com.trooi.app.core.model.LocalLandlordApplication
import org.junit.Assert.*
import org.junit.Test

class LandlordApplicationTest {
    private val application = LocalLandlordApplication(
        "Nguyễn Văn A", "1997-07-09", "0901234567", "contact@example.test",
        identityDetailsReviewed = true, contactConfirmed = true, termsAccepted = true,
        firstAsset = null, publish = false,
    )
    @Test fun firstPropertyIsOptionalAndCannotBePublishedWithoutAnAsset() {
        assertTrue(application.valid())
        assertFalse(application.copy(publish = true).valid())
    }
    @Test fun incompleteIdentityContactAndAgreementCannotCompleteSetup() {
        assertFalse(application.copy(identityDetailsReviewed = false).valid())
        assertFalse(application.copy(contactConfirmed = false).valid())
        assertFalse(application.copy(termsAccepted = false).valid())
        assertFalse(application.copy(birthDate = "1997-02-31").valid())
        assertFalse(application.copy(phone = "invalid").valid())
        assertFalse(application.copy(email = "invalid").valid())
    }
}
