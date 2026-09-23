package com.arthunt.core.domain

import kotlin.random.Random
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class PathGeneratorTest {
    @Test
    fun `linear path is 0 through n-1 in order`() {
        val path = PathGenerator.generatePath(5, randomizedPathing = false)
        assertEquals(listOf(0, 1, 2, 3, 4), path)
    }

    @Test
    fun `randomized path always starts with marker 0`() {
        repeat(20) { seed ->
            val path = PathGenerator.generatePath(6, randomizedPathing = true, random = Random(seed.toLong()))
            assertEquals(0, path.first())
        }
    }

    @Test
    fun `randomized path is a permutation of every marker index exactly once`() {
        val path = PathGenerator.generatePath(8, randomizedPathing = true, random = Random(42))
        assertEquals((0 until 8).toSet(), path.toSet())
        assertEquals(8, path.size)
    }

    @Test
    fun `randomized path with an injected random is deterministic and reproducible`() {
        val a = PathGenerator.generatePath(10, randomizedPathing = true, random = Random(7))
        val b = PathGenerator.generatePath(10, randomizedPathing = true, random = Random(7))
        assertEquals(a, b)
    }

    @Test
    fun `single marker event produces the trivial path either way`() {
        assertEquals(listOf(0), PathGenerator.generatePath(1, randomizedPathing = false))
        assertEquals(listOf(0), PathGenerator.generatePath(1, randomizedPathing = true, random = Random(1)))
    }

    @Test
    fun `zero markers produces an empty path`() {
        assertTrue(PathGenerator.generatePath(0, randomizedPathing = false).isEmpty())
        assertTrue(PathGenerator.generatePath(0, randomizedPathing = true).isEmpty())
    }
}
