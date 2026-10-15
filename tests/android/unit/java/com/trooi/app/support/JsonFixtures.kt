package com.trooi.app.support

import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.google.gson.JsonParser

/** Validates the schema keywords used by these versioned unit-test fixtures. */
object JsonFixtures {
    fun resource(name: String): JsonObject =
        checkNotNull(javaClass.classLoader?.getResourceAsStream("fixtures/$name")) {
            "Missing unit-test fixture: $name"
        }.bufferedReader().use { JsonParser.parseReader(it).asJsonObject }

    fun load(name: String): JsonObject = resource("$name.json").also {
        validate(it, resource("$name.schema.json"))
    }

    fun validate(value: JsonElement, schema: JsonObject) {
        val type = schema.get("type").asString
        require(when (type) {
            "null" -> value.isJsonNull
            "object" -> value.isJsonObject
            "array" -> value.isJsonArray
            "string" -> value.isJsonPrimitive && value.asJsonPrimitive.isString
            "boolean" -> value.isJsonPrimitive && value.asJsonPrimitive.isBoolean
            "integer" -> value.isJsonPrimitive && value.asJsonPrimitive.isNumber &&
                value.asString.matches(Regex("-?[0-9]+"))
            else -> false
        }) { "Invalid fixture type: $type" }
        schema.getAsJsonArray("enum")?.let { allowed ->
            require(allowed.any { it == value }) { "Unsupported fixture version or value" }
        }
        if (type == "object") {
            val obj = value.asJsonObject
            val properties = schema.getAsJsonObject("properties")
            val required = schema.getAsJsonArray("required").map { it.asString }
            require(required.all { obj.has(it) }) { "Missing fixture fields" }
            if (schema.get("additionalProperties")?.asBoolean == false) {
                require(properties.keySet().containsAll(obj.keySet())) { "Unknown fixture fields" }
            }
            obj.entrySet().forEach { (key, entry) ->
                properties.get(key)?.let { validate(entry, it.asJsonObject) }
            }
        }
        if (type == "array") {
            val entries = value.asJsonArray
            schema.get("maxItems")?.let { require(entries.size() <= it.asInt) { "Too many fixture items" } }
            schema.get("minItems")?.let { require(entries.size() >= it.asInt) { "Too few fixture items" } }
            schema.getAsJsonObject("items")?.let { itemSchema -> entries.forEach { validate(it, itemSchema) } }
        }
    }
}
