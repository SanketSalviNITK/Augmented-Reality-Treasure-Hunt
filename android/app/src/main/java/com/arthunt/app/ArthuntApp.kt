package com.arthunt.app

import android.app.Application
import com.arthunt.app.di.AppContainer

class ArthuntApp : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }
}
