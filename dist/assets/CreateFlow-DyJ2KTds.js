var si=Object.defineProperty;var oi=(e,t,s)=>t in e?si(e,t,{enumerable:!0,configurable:!0,writable:!0,value:s}):e[t]=s;var nt=(e,t,s)=>oi(e,typeof t!="symbol"?t+"":t,s);import{c as Gt,r as m,j as i,l as rt,m as zt,a as ni,C as ai,k as Ht,n as ri,Z as Jt,o as li,p as ci,q as it,t as di,v as pi,w as dt,J as st,x as ui,y as mi,s as J,b as Pe,u as he,z as wt,h as kt,B as He,D as gi,P as fi,F as hi,G as Ve,H as bi,I as xi,K as wi,N as yi,O as vi,Q as ki,U as Kt,V as Ai,W as Le,X as Si,d as Ci,Y as Ni,_ as lt,g as Nt,$ as ji,a0 as Pi,a1 as jt,a2 as Ii,a3 as Pt,T as ht,a4 as _i,a5 as Ei,M as Di,a6 as Ri,a7 as Ti,a8 as $i}from"./index-D8548VFO.js";import{S as pt}from"./sparkles-D4SxQgF8.js";import{l as Oi,g as Mi,r as It}from"./iconRenderer-D4g_Vyuc.js";import{l as Fi,g as Bi}from"./pluginSecretsService-sgd2wSSP.js";import{G as Ui}from"./GitHubImport-ClDrJhXk.js";import{L as Li,a as Vi}from"./label-Bt3zEolV.js";import{F as Wi}from"./file-json-DSTQ7d6f.js";import{F as Gi}from"./file-archive-DXN6FSlh.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const yt=Gt("ArrowLeft",[["path",{d:"m12 19-7-7 7-7",key:"1l729n"}],["path",{d:"M19 12H5",key:"x3x0zl"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ct=Gt("FileCode2",[["path",{d:"M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4",key:"1pf5j1"}],["path",{d:"M14 2v4a2 2 0 0 0 2 2h4",key:"tnqrlb"}],["path",{d:"m5 12-3 3 3 3",key:"oke12k"}],["path",{d:"m9 18 3-3-3-3",key:"112psh"}]]),_t={thinking:{icon:pt,colorClass:"text-primary"},reasoning:{icon:Ht,colorClass:"text-muted-foreground"},tool_call:{icon:ri,colorClass:"text-[hsl(var(--info))]",label:"Calling tool"},tool_result:{icon:Jt,colorClass:"text-[hsl(var(--success))]",label:"Result"},question:{icon:li,colorClass:"text-[hsl(var(--warning))]"},success:{icon:rt,colorClass:"text-[hsl(var(--success))]"},error:{icon:zt,colorClass:"text-destructive"}},qt=({actions:e,className:t="",estimatedTimeRemaining:s,progressPercent:o,elapsedSeconds:a})=>{var g;const r=m.useRef(null);m.useEffect(()=>{r.current&&(r.current.scrollTop=r.current.scrollHeight)},[e.length,(g=e[e.length-1])==null?void 0:g.status]);const l=s!==void 0&&s>0,b=o!==void 0&&o>0;return i.jsxs("div",{ref:r,className:`activity-feed-container overflow-y-auto h-full ${t}`,children:[(l||b)&&i.jsxs("div",{className:"px-3 py-2 border-b border-border/30",children:[i.jsxs("div",{className:"flex items-center justify-between text-[10px] text-muted-foreground mb-1.5",children:[i.jsx("span",{className:"tabular-nums",children:a!==void 0?`${a.toFixed(0)}s elapsed`:""}),l&&i.jsxs("span",{className:"tabular-nums text-primary font-medium",children:["~",Math.ceil(s),"s remaining"]})]}),b&&i.jsx("div",{className:"w-full h-1 bg-muted/40 rounded-full overflow-hidden",children:i.jsx("div",{className:"h-full bg-primary rounded-full transition-all duration-500 ease-out",style:{width:`${Math.min(100,o)}%`}})})]}),e.map((P,N)=>i.jsx(zi,{action:P,isLast:N===e.length-1},P.id))]})},zi=({action:e,isLast:t})=>{const[s,o]=m.useState(e.elapsed||0),[a,r]=m.useState(!0),l=_t[e.type]||_t.thinking,b=l.icon;m.useEffect(()=>{if(e.status!=="active"||!e.startedAt)return;const p=setInterval(()=>{o((Date.now()-e.startedAt)/1e3)},100);return()=>clearInterval(p)},[e.status,e.startedAt]);const g=(e.status==="done"||e.status==="error")&&e.elapsed||s,P=e.status==="done",N=e.status==="active",c=e.status==="error";return i.jsxs("div",{className:"activity-item animate-fade-in relative",children:[!t&&i.jsx("div",{className:"activity-connector"}),i.jsxs("div",{className:"flex items-start gap-3 py-2.5 px-3 relative",children:[i.jsx("div",{className:`activity-node shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 ${P?"bg-[hsl(var(--success))]/15":c?"bg-destructive/15":N?"bg-primary/15 activity-node-pulse":"bg-muted/50"}`,children:P?i.jsx(rt,{size:15,className:"text-[hsl(var(--success))]"}):c?i.jsx(zt,{size:15,className:"text-destructive"}):i.jsx(b,{size:15,className:`${l.colorClass} ${N?"animate-pulse":""}`})}),i.jsxs("div",{className:"flex-1 min-w-0",children:[i.jsxs("div",{className:"flex items-center gap-2",children:[l.label&&N&&i.jsx("span",{className:"text-[10px] font-medium text-muted-foreground uppercase tracking-wider",children:l.label}),i.jsx("span",{className:`text-sm leading-tight transition-all duration-300 ${P?"text-muted-foreground/70":c?"text-destructive/80":N?"ai-action-active font-medium":"text-muted-foreground/40"}`,children:e.title}),(P||N||c)&&g>0&&i.jsxs("span",{className:`text-[10px] tabular-nums shrink-0 ml-auto ${N?"text-primary":"text-muted-foreground/40"}`,children:[g.toFixed(1),"s"]})]}),e.detail&&P&&i.jsx("p",{className:"text-xs text-muted-foreground/60 mt-0.5 leading-relaxed",children:e.detail}),e.result&&(P||c)&&i.jsxs("div",{className:"mt-1.5",children:[i.jsxs("button",{onClick:()=>r(!a),className:"flex items-center gap-1 text-[10px] font-medium text-muted-foreground/50 hover:text-muted-foreground transition-colors",children:[a?i.jsx(ni,{size:10}):i.jsx(ai,{size:10}),a?"Show result":"Hide result"]}),!a&&i.jsx("div",{className:"mt-1 px-2.5 py-2 rounded-lg bg-muted/30 border border-border/50 animate-fade-in",children:i.jsx("pre",{className:"text-[11px] font-mono text-muted-foreground whitespace-pre-wrap break-all leading-relaxed",children:e.result})})]})]})]})]})},Hi=({content:e,isStreaming:t,label:s="ForgeAI",className:o=""})=>{const a=m.useRef(null);return m.useEffect(()=>{a.current&&(a.current.scrollTop=a.current.scrollHeight)},[e]),i.jsxs("div",{className:`rounded-xl border border-border bg-card overflow-hidden ${o}`,children:[i.jsxs("div",{className:"flex items-center gap-2 px-4 py-3 border-b border-border",children:[i.jsx("div",{className:"w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center",children:i.jsx(pt,{size:13,className:"text-primary"})}),i.jsx("span",{className:"text-sm font-semibold text-foreground",children:s}),t&&i.jsx("span",{className:"ml-auto text-[11px] shimmer-text font-medium",children:"analyzing..."})]}),i.jsx("div",{ref:a,className:"px-4 py-3 max-h-[500px] overflow-y-auto",children:i.jsx("div",{className:`ai-chat-prose ${t?"ai-chat-streaming":""}`,children:i.jsx(ci,{children:e})})})]})},Ji={scan:"tool_call",compatibility:"tool_call",dependencies:"tool_call",plugins:"tool_call",config:"tool_call","ai-inject":"reasoning",bundle:"tool_call",upload:"tool_call",build:"tool_call"},at={setup:"Setup & Dependencies","ai-wiring":"AI Code Integration",build:"Build & Deliver"};function Ki({orchestrator:e,buildPlan:t}){const[s,o]=m.useState([]),[a,r]=m.useState([{id:"setup",label:at.setup,status:"pending",actions:[]},{id:"ai-wiring",label:at["ai-wiring"],status:"pending",actions:[]},{id:"build",label:at.build,status:"pending",actions:[]}]),[l,b]=m.useState(0),g=m.useRef(null),P=m.useRef(new Map),N=m.useRef(new Map);m.useEffect(()=>{if(!e)return;g.current=Date.now();const j=setInterval(()=>{g.current&&b((Date.now()-g.current)/1e3)},500);return()=>clearInterval(j)},[e]);const c=m.useCallback((j,f)=>{N.current.set(j.id,f),o(D=>[...D,j]),r(D=>D.map(h=>h.id===f?{...h,actions:[...h.actions,j]}:h))},[]),p=m.useCallback((j,f)=>{o(h=>h.map(U=>U.id===j?{...U,...f}:U));const D=N.current.get(j);D&&r(h=>h.map(U=>U.id===D?{...U,actions:U.actions.map(de=>de.id===j?{...de,...f}:de)}:U))},[]);m.useEffect(()=>e?e.onMacroPhase(f=>{r(D=>D.map(h=>{if(h.id!==f.macroPhase)return h;switch(f.status){case"start":return{...h,status:"active",startedAt:Date.now()};case"complete":return{...h,status:"done",elapsed:f.elapsed};case"error":return{...h,status:"error",elapsed:f.elapsed};default:return h}}))}):void 0,[e]),m.useEffect(()=>e?e.on(f=>{const D=Ji[f.phase]||"tool_call",h=f.macroPhase||"setup";switch(f.status){case"start":{const U=crypto.randomUUID();P.current.set(f.phase,U);const de={id:U,type:D,title:f.label,status:"active",startedAt:Date.now()};c(de,h);break}case"complete":{const U=P.current.get(f.phase);U&&p(U,{status:"done",detail:f.detail,elapsed:f.elapsed});break}case"skip":{const de={id:crypto.randomUUID(),type:D,title:`${f.label} — skipped`,status:"done",detail:f.detail,elapsed:0};c(de,h);break}case"error":{const U=P.current.get(f.phase);U&&p(U,{status:"error",detail:f.detail,elapsed:f.elapsed});break}}}):void 0,[e,c,p]);const S=(t==null?void 0:t.totalEstimatedSeconds)??0,u=s.filter(j=>j.status==="done"||j.status==="error").reduce((j,f)=>j+(f.elapsed||0),0),x=Math.max(0,S-u),y=S>0?Math.min(100,u/S*100):0,I=m.useCallback((j,f="thinking",D,h)=>{const U=crypto.randomUUID(),de={id:U,type:f,title:j,status:"active",startedAt:Date.now(),detail:D};return c(de,h||"build"),U},[c]),w=m.useCallback((j,f)=>{p(j,f)},[p]),v=m.useCallback((j,f)=>{p(j,{status:"done",detail:f||void 0,elapsed:void 0})},[p]),H=m.useCallback((j,f)=>{p(j,{status:"error",detail:f||void 0})},[p]),Q=m.useCallback((j,f,D)=>{const h=crypto.randomUUID(),U={id:h,type:"tool_call",title:j,status:f,startedAt:Date.now(),elapsed:D};return c(U,"build"),h},[c]),ce=m.useCallback((j,f,D)=>{p(j,{status:f,elapsed:D})},[p]),A=m.useCallback(()=>{o([]),r([{id:"setup",label:at.setup,status:"pending",actions:[]},{id:"ai-wiring",label:at["ai-wiring"],status:"pending",actions:[]},{id:"build",label:at.build,status:"pending",actions:[]}]),b(0),g.current=null,P.current.clear(),N.current.clear()},[]);return{actions:s,phaseGroups:a,estimatedTimeRemaining:x,totalEstimatedSeconds:S,elapsedSeconds:l,progressPercent:y,addCustomAction:I,updateAction:w,completeAction:v,errorAction:H,addGitHubStep:Q,updateGitHubStep:ce,reset:A}}const qi=()=>`distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-8.10.2-all.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
`,Zi=()=>`#!/bin/sh

#
# Copyright © 2015-2021 the original authors.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

##############################################################################
#
#   Gradle start up script for POSIX generated by Gradle.
#
##############################################################################

# Attempt to set APP_HOME
PRG="$0"
while [ -h "$PRG" ] ; do
    ls=\`ls -ld "$PRG"\`
    link=\`expr "$ls" : '.*-> \\(.*\\)$'\`
    if expr "$link" : '/.*' > /dev/null; then
        PRG="$link"
    else
        PRG=\`dirname "$PRG"\`"/$link"
    fi
done
SAVED="\`pwd\`"
cd "\`dirname \\"$PRG\\"\`/" >/dev/null
APP_HOME="\`pwd -P\`"
cd "$SAVED" >/dev/null

APP_NAME="Gradle"
APP_BASE_NAME=\`basename "$0"\`

DEFAULT_JVM_OPTS="-Xmx64m -Xms64m"

CLASSPATH=$APP_HOME/gradle/wrapper/gradle-wrapper.jar

# Determine the Java command to use to start the JVM.
if [ -n "$JAVA_HOME" ] ; then
    JAVACMD="$JAVA_HOME/bin/java"
else
    JAVACMD="java"
fi

exec "$JAVACMD" $DEFAULT_JVM_OPTS $JAVA_OPTS $GRADLE_OPTS \\
  "-Dorg.gradle.appname=$APP_BASE_NAME" \\
  -classpath "$CLASSPATH" \\
  org.gradle.wrapper.GradleWrapperMain "$@"
`,Xi=()=>`@rem
@rem Copyright 2015 the original author or authors.
@rem
@rem Licensed under the Apache License, Version 2.0 (the "License");
@rem you may not use this file except in compliance with the License.
@rem You may obtain a copy of the License at
@rem
@rem      https://www.apache.org/licenses/LICENSE-2.0
@rem
@rem Unless required by applicable law or agreed to in writing, software
@rem distributed under the License is distributed on an "AS IS" BASIS,
@rem WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
@rem See the License for the specific language governing permissions and
@rem limitations under the License.
@rem

@if "%DEBUG%"=="" @echo off
@rem ##########################################################################
@rem
@rem  Gradle startup script for Windows
@rem
@rem ##########################################################################

@rem Set local scope for the variables with windows NT shell
if "%OS%"=="Windows_NT" setlocal

set DIRNAME=%~dp0
if "%DIRNAME%"=="" set DIRNAME=.
@rem This is normally unused
set APP_BASE_NAME=%~n0
set APP_HOME=%DIRNAME%

@rem Resolve any "." and ".." in APP_HOME to make it shorter.
for %%i in ("%APP_HOME%") do set APP_HOME=%%~fi

set DEFAULT_JVM_OPTS="-Xmx64m" "-Xms64m"

set CLASSPATH=%APP_HOME%\\gradle\\wrapper\\gradle-wrapper.jar

@rem Find java.exe
if defined JAVA_HOME goto findJavaFromJavaHome
set JAVA_EXE=java.exe
goto execute

:findJavaFromJavaHome
set JAVA_HOME=%JAVA_HOME:"=%
set JAVA_EXE=%JAVA_HOME%/bin/java.exe
goto execute

:execute
"%JAVA_EXE%" %DEFAULT_JVM_OPTS% %JAVA_OPTS% %GRADLE_OPTS% "-Dorg.gradle.appname=%APP_BASE_NAME%" -classpath "%CLASSPATH%" org.gradle.wrapper.GradleWrapperMain %*

:end
@rem End local scope for the variables with windows NT shell
if "%OS%"=="Windows_NT" endlocal

:omega
`,Yi=()=>`# Project-wide Gradle settings.
org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
# AndroidX
android.useAndroidX=true
android.nonTransitiveRClass=true
`,Qi=()=>`# This file should *NOT* be checked into Version Control Systems,
# as it contains information specific to your local configuration.
# Location of the SDK. This is only used by Gradle.
# sdk.dir=/Users/USERNAME/Library/Android/sdk
`,es=()=>`# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /sdk/tools/proguard/proguard-android.txt

# Keep JavaScript interface methods
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# If using Capacitor
-keep class com.getcapacitor.** { *; }
-keep class org.apache.cordova.** { *; }
`,ts=(e,t)=>`<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${e}</string>
    <string name="title_activity_main">${e}</string>
    <string name="package_name">${t||e.toLowerCase().replace(/\s+/g,".")}</string>
    <string name="custom_url_scheme">${t||e.toLowerCase().replace(/\s+/g,".")}</string>
</resources>
`,is=()=>`<?xml version="1.0" encoding="utf-8"?>
<paths>
    <external-path name="my_images" path="." />
    <cache-path name="my_cache_images" path="." />
    <files-path name="my_files" path="." />
</paths>
`,ss=()=>new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,6,0,0,0,31,21,196,137,0,0,0,10,73,68,65,84,120,156,98,0,0,0,2,0,1,229,39,222,252,0,0,0,0,73,69,78,68,174,66,96,130]).buffer,os=()=>`<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@android:color/white" />
</layer-list>
`,At=e=>{const t=[{path:"gradle/wrapper/gradle-wrapper.properties",content:qi()},{path:"gradlew",content:Zi()},{path:"gradlew.bat",content:Xi()},{path:"gradle.properties",content:Yi()},{path:"local.properties",content:Qi()},{path:"app/proguard-rules.pro",content:es()},{path:"app/src/main/res/values/strings.xml",content:ts(e.appName,e.packageName)},{path:"app/src/main/res/xml/file_paths.xml",content:is()},{path:"app/src/main/res/drawable/splash_screen.xml",content:os()},{path:"README.md",content:ns(e)}];if(e.icons&&e.icons.length>0)for(const s of e.icons)t.push({path:`app/src/main/res/${s.folder}/ic_launcher.png`,content:s.squareBlob,isBinary:!0}),t.push({path:`app/src/main/res/${s.folder}/ic_launcher_round.png`,content:s.roundBlob,isBinary:!0});else{const s=ss(),o=["mipmap-mdpi","mipmap-hdpi","mipmap-xhdpi","mipmap-xxhdpi"];for(const r of o)t.push({path:`app/src/main/res/${r}/ic_launcher.png`,content:s,isBinary:!0}),t.push({path:`app/src/main/res/${r}/ic_launcher_round.png`,content:s,isBinary:!0});const a=`<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/colorPrimary"/>
    <foreground android:drawable="@color/colorPrimary"/>
</adaptive-icon>
`;t.push({path:"app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml",content:a}),t.push({path:"app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml",content:a})}return t},ns=e=>`# ${e.appName}

Android project generated by MobileForge.

## Build Instructions

1. Open this project in Android Studio (Hedgehog or newer)
2. Wait for Gradle sync to complete
3. Connect a device or start an emulator (API 24+)
4. Click Run ▶️

## Configuration

- **Package:** \`${e.packageName}\`
- **Min SDK:** 24 (Android 7.0)
- **Target SDK:** 34
- **Compile SDK:** 34

Generated by MobileForge — https://mobileforge.dev
`,as=()=>`plugins {
    id 'com.android.application' version '8.2.2' apply false
}`,rs=e=>`pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "${e}"
include ':app'
`,ls=e=>`plugins {
    id 'com.android.application'
}

android {
    namespace '${e}'
    compileSdk 36

    defaultConfig {
        applicationId "${e}"
        minSdk 24
        targetSdk 36
        versionCode 1
        versionName "1.0"
    }

    buildTypes {
        release {
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
}

dependencies {
    implementation 'androidx.appcompat:appcompat:1.7.0'
    implementation 'androidx.webkit:webkit:1.12.1'
    implementation 'androidx.core:core-splashscreen:1.0.1'
    implementation 'androidx.activity:activity:1.9.0'
    implementation 'androidx.swiperefreshlayout:swiperefreshlayout:1.1.0'
}
`,cs=()=>`<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="android:Theme.Material.Light.NoActionBar">
        <item name="android:windowBackground">@drawable/splash_screen</item>
        <item name="android:statusBarColor">@android:color/transparent</item>
        <item name="android:navigationBarColor">@android:color/transparent</item>
        <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>
        <item name="android:windowDrawsSystemBarBackgrounds">true</item>
    </style>

    <style name="AppTheme.EdgeToEdge" parent="AppTheme">
        <item name="android:fitsSystemWindows">false</item>
    </style>
</resources>
`,ds=()=>`<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="splash_background">#FFFFFF</color>
    <color name="status_bar">#00000000</color>
    <color name="navigation_bar">#00000000</color>
</resources>
`,ps=()=>`<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
</network-security-config>
`,us=e=>`<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="${e}">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.DOWNLOAD_WITHOUT_NOTIFICATION" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme.EdgeToEdge"
        android:usesCleartextTraffic="true"
        android:networkSecurityConfig="@xml/network_security_config">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|screenLayout|smallestScreenSize|keyboardHidden|keyboard|uiMode"
            android:launchMode="singleTop"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="\${applicationId}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths" />
        </provider>
    </application>
</manifest>
`,ms=(e,t)=>`package ${e};

import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

public class MainActivity extends Activity {

    private WebView webView;
    private SwipeRefreshLayout swipeRefresh;
    private ValueCallback<Uri[]> fileUploadCallback;
    private static final int FILE_CHOOSER_REQUEST = 1001;
    private static final int PERMISSION_REQUEST = 1002;
    private static final String HOME_URL = "${t}";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // === Edge-to-edge setup ===
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE |
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            );
        }
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            getWindow().getAttributes().layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }

        // === Layout: SwipeRefreshLayout > WebView ===
        swipeRefresh = new SwipeRefreshLayout(this);
        webView = new WebView(this);
        swipeRefresh.addView(webView, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(swipeRefresh);

        // Handle system bar insets for edge-to-edge
        ViewCompat.setOnApplyWindowInsetsListener(swipeRefresh, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return insets;
        });

        swipeRefresh.setOnRefreshListener(() -> {
            webView.reload();
        });

        // === Cookies ===
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        // === WebView Settings ===
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setGeolocationEnabled(true);
        settings.setSupportMultipleWindows(false);
        settings.setUserAgentString(settings.getUserAgentString() + " NativeBridge/1.0");

        // === JS Bridge ===
        webView.addJavascriptInterface(new NativeBridge(), "NativeBridge");

        // === WebViewClient ===
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String reqUrl = request.getUrl().toString();
                // Handle external intents (tel:, mailto:, intent:, market:)
                if (reqUrl.startsWith("tel:") || reqUrl.startsWith("mailto:") ||
                    reqUrl.startsWith("intent:") || reqUrl.startsWith("market:") ||
                    reqUrl.startsWith("whatsapp:")) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(reqUrl));
                        startActivity(intent);
                    } catch (Exception e) { /* ignore */ }
                    return true;
                }
                return false; // Let WebView handle it
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                swipeRefresh.setRefreshing(true);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                swipeRefresh.setRefreshing(false);
                CookieManager.getInstance().flush();
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    swipeRefresh.setRefreshing(false);
                    // Show offline error page
                    view.loadData(getOfflineHtml(), "text/html", "UTF-8");
                }
            }
        });

        // === WebChromeClient (file upload + geolocation) ===
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                    FileChooserParams params) {
                if (fileUploadCallback != null) fileUploadCallback.onReceiveValue(null);
                fileUploadCallback = callback;
                Intent intent = params.createIntent();
                try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST);
                } catch (Exception e) {
                    fileUploadCallback = null;
                    return false;
                }
                return true;
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(String origin,
                    GeolocationPermissions.Callback callback) {
                if (ContextCompat.checkSelfPermission(MainActivity.this,
                        Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                    callback.invoke(origin, true, false);
                } else {
                    ActivityCompat.requestPermissions(MainActivity.this,
                        new String[]{ Manifest.permission.ACCESS_FINE_LOCATION }, PERMISSION_REQUEST);
                    callback.invoke(origin, true, false);
                }
            }
        });

        // === Download support ===
        webView.setDownloadListener((downloadUrl, userAgent, contentDisposition, mimeType, contentLength) -> {
            try {
                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(downloadUrl));
                String filename = URLUtil.guessFileName(downloadUrl, contentDisposition, mimeType);
                request.setTitle(filename);
                request.setMimeType(mimeType);
                request.allowScanningByMediaScanner();
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename);

                DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                if (dm != null) {
                    dm.enqueue(request);
                    Toast.makeText(this, "Downloading " + filename, Toast.LENGTH_SHORT).show();
                }
            } catch (Exception e) {
                Toast.makeText(this, "Download failed", Toast.LENGTH_SHORT).show();
            }
        });

        // === Load URL or show offline page ===
        if (isNetworkAvailable()) {
            webView.loadUrl(HOME_URL);
        } else {
            webView.loadData(getOfflineHtml(), "text/html", "UTF-8");
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQUEST) {
            if (fileUploadCallback != null) {
                Uri[] results = null;
                if (resultCode == RESULT_OK && data != null) {
                    String dataString = data.getDataString();
                    if (dataString != null) results = new Uri[]{ Uri.parse(dataString) };
                }
                fileUploadCallback.onReceiveValue(results);
                fileUploadCallback = null;
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (webView != null) webView.onPause();
        CookieManager.getInstance().flush();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
        }
        super.onDestroy();
    }

    private boolean isNetworkAvailable() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        if (cm == null) return false;
        NetworkCapabilities nc = cm.getNetworkCapabilities(cm.getActiveNetwork());
        return nc != null && nc.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
    }

    private String getOfflineHtml() {
        return "<html><head><meta name='viewport' content='width=device-width,initial-scale=1'>" +
            "<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;" +
            "display:flex;align-items:center;justify-content:center;height:100vh;background:#f5f5f5;color:#333}" +
            ".c{text-align:center;padding:2rem}h1{font-size:1.5rem;margin-bottom:.5rem}" +
            "p{color:#666;margin-bottom:1.5rem}button{padding:.75rem 2rem;background:#2563eb;color:#fff;" +
            "border:none;border-radius:8px;font-size:1rem;cursor:pointer}</style></head>" +
            "<body><div class='c'><h1>No Connection</h1><p>Check your internet and try again.</p>" +
            "<button onclick='window.location.reload()'>Retry</button></div></body></html>";
    }

    /** JavaScript bridge for native functionality */
    public class NativeBridge {
        @JavascriptInterface
        public String getPlatform() { return "android"; }

        @JavascriptInterface
        public String getVersion() { return "1.0"; }

        @JavascriptInterface
        public void showToast(String message) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, message, Toast.LENGTH_SHORT).show());
        }

        @JavascriptInterface
        public boolean isOnline() { return isNetworkAvailable(); }

        @JavascriptInterface
        public void openExternal(String url) {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                startActivity(intent);
            } catch (Exception e) { /* ignore */ }
        }
    }
}
`,gs=e=>`package ${e};

import android.app.Activity;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

public class MainActivity extends Activity {

    private WebView webView;
    private SwipeRefreshLayout swipeRefresh;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Edge-to-edge
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE |
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            );
        }
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);

        swipeRefresh = new SwipeRefreshLayout(this);
        webView = new WebView(this);
        swipeRefresh.addView(webView, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(swipeRefresh);

        ViewCompat.setOnApplyWindowInsetsListener(swipeRefresh, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return insets;
        });

        swipeRefresh.setOnRefreshListener(() -> webView.reload());

        CookieManager.getInstance().setAcceptCookie(true);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(false);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                swipeRefresh.setRefreshing(false);
            }
        });
        webView.setWebChromeClient(new WebChromeClient());

        webView.loadUrl("file:///android_asset/public/index.html");
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
`,fs=e=>{const t=e.packageName.replace(/\./g,"/"),s=!!e.url;return[...At(e),{path:"build.gradle",content:as()},{path:"settings.gradle",content:rs(e.appName)},{path:"app/build.gradle",content:ls(e.packageName)},{path:"app/src/main/AndroidManifest.xml",content:us(e.packageName)},{path:"app/src/main/res/values/styles.xml",content:cs()},{path:"app/src/main/res/values/colors.xml",content:ds()},{path:"app/src/main/res/xml/network_security_config.xml",content:ps()},{path:`app/src/main/java/${t}/MainActivity.java`,content:s?ms(e.packageName,e.url):gs(e.packageName)}]},Zt={capacitorVersion:it.capacitorVersion,compileSdk:it.compileSdk,targetSdk:it.targetSdk,minSdk:it.minSdk,agpVersion:it.agpVersion,gradleVersion:it.gradleVersion,jdkVersion:it.jdkVersion,androidxActivityVersion:"1.9.3",androidxAppCompatVersion:"1.7.0",androidxCoordinatorLayoutVersion:"1.2.0",androidxCoreVersion:"1.15.0",androidxFragmentVersion:"1.8.5",coreSplashScreenVersion:"1.0.1",androidxWebkitVersion:"1.12.1",junitVersion:"4.13.2",androidxJunitVersion:"1.2.1",androidxEspressoCoreVersion:"3.6.1",cordovaAndroidVersion:"10.1.1"};function Xt(e=Zt){return`ext {
    minSdkVersion = ${e.minSdk}
    compileSdkVersion = ${e.compileSdk}
    targetSdkVersion = ${e.targetSdk}
    androidxActivityVersion = '${e.androidxActivityVersion}'
    androidxAppCompatVersion = '${e.androidxAppCompatVersion}'
    androidxCoordinatorLayoutVersion = '${e.androidxCoordinatorLayoutVersion}'
    androidxCoreVersion = '${e.androidxCoreVersion}'
    androidxFragmentVersion = '${e.androidxFragmentVersion}'
    coreSplashScreenVersion = '${e.coreSplashScreenVersion}'
    androidxWebkitVersion = '${e.androidxWebkitVersion}'
    junitVersion = '${e.junitVersion}'
    androidxJunitVersion = '${e.androidxJunitVersion}'
    androidxEspressoCoreVersion = '${e.androidxEspressoCoreVersion}'
    cordovaAndroidVersion = '${e.cordovaAndroidVersion}'
}
`}const hs=()=>Xt(),bs=()=>`buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath 'com.android.tools.build:gradle:8.7.3'
        classpath 'com.google.gms:google-services:4.4.0'
    }
}

apply from: "variables.gradle"

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

task clean(type: Delete) {
    delete rootProject.buildDir
}
`,xs=e=>`include ':app'
rootProject.name = '${e}'
`,ws=e=>`apply plugin: 'com.android.application'

android {
    namespace "${e}"
    compileSdk rootProject.ext.compileSdkVersion

    defaultConfig {
        applicationId "${e}"
        minSdk rootProject.ext.minSdkVersion
        targetSdk rootProject.ext.targetSdkVersion
        versionCode 1
        versionName "1.0"
        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_21
        targetCompatibility JavaVersion.VERSION_21
    }
}

dependencies {
    // Capacitor core (Maven Central artifact)
    implementation 'com.capacitorjs:core:7.5.0'
    implementation 'org.apache.cordova:framework:10.1.1'
    implementation "androidx.appcompat:appcompat:$androidxAppCompatVersion"
    implementation "androidx.coordinatorlayout:coordinatorlayout:$androidxCoordinatorLayoutVersion"
    implementation "androidx.activity:activity:$androidxActivityVersion"
    implementation "androidx.fragment:fragment:$androidxFragmentVersion"
    implementation "androidx.webkit:webkit:$androidxWebkitVersion"

    testImplementation "junit:junit:$junitVersion"
    androidTestImplementation "androidx.test.ext:junit:$androidxJunitVersion"
    androidTestImplementation "androidx.test.espresso:espresso-core:$androidxEspressoCoreVersion"
}
`,ys=e=>`<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
            android:launchMode="singleTask"
            android:theme="@style/AppTheme.NoActionBarLaunch">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="\${applicationId}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths" />
        </provider>
    </application>
</manifest>
`,vs=e=>`package ${e};

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }
}
`,ks=()=>`<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="Theme.AppCompat.Light.DarkActionBar">
        <item name="colorPrimary">@color/colorPrimary</item>
        <item name="colorPrimaryDark">@color/colorPrimaryDark</item>
        <item name="colorAccent">@color/colorAccent</item>
    </style>

    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:background">@null</item>
    </style>

    <style name="AppTheme.NoActionBarLaunch" parent="AppTheme.NoActionBar">
        <item name="android:background">@drawable/splash_screen</item>
    </style>
</resources>
`,As=()=>`<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">#FF6200EE</color>
    <color name="colorPrimaryDark">#FF3700B3</color>
    <color name="colorAccent">#FF03DAC5</color>
</resources>
`,Ss=(e,t)=>`import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: '${e}',
  appName: '${t}',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    hostname: 'localhost',
    cleartext: true,
  },
  android: {
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#111111',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
  },
};

export default config;
`,Cs=(e,t,s)=>{const o={appId:e,appName:t,webDir:"public",server:{androidScheme:"https",hostname:"localhost",cleartext:!0,...s?{url:s}:{}},android:{webContentsDebuggingEnabled:!0},plugins:{SplashScreen:{launchShowDuration:1500,launchAutoHide:!0,backgroundColor:"#111111",androidSplashResourceName:"splash",androidScaleType:"CENTER_CROP",showSpinner:!1}}};return JSON.stringify(o,null,2)},Ns=e=>`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Loading...</title>
  <style>
    body { margin: 0; display: flex; align-items: center; justify-content: center; height: 100vh; font-family: system-ui, sans-serif; background: #111; color: #fff; }
    .loader { text-align: center; }
    .spinner { width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.2); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="loader">
    <div class="spinner"></div>
    <p>Loading app...</p>
  </div>
${e?`  <script>window.location.href = ${JSON.stringify(e)};<\/script>`:""}
</body>
</html>
`,Yt=e=>{const t=e.packageName.replace(/\./g,"/");return[...At(e),{path:"variables.gradle",content:hs()},{path:"build.gradle",content:bs()},{path:"settings.gradle",content:xs(e.appName)},{path:"app/build.gradle",content:ws(e.packageName)},{path:"app/src/main/AndroidManifest.xml",content:ys(e.packageName)},{path:`app/src/main/java/${t}/MainActivity.java`,content:vs(e.packageName)},{path:"app/src/main/res/values/styles.xml",content:ks()},{path:"app/src/main/res/values/colors.xml",content:As()},{path:"capacitor.config.ts",content:Ss(e.packageName,e.appName)},{path:"app/src/main/assets/capacitor.config.json",content:Cs(e.packageName,e.appName,e.url)},{path:"app/src/main/assets/public/index.html",content:Ns(e.url)}]},js=e=>{const t=Yt(e),s=t.findIndex(a=>a.path==="capacitor.config.ts");s!==-1&&(t[s]={path:"capacitor.config.ts",content:`import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: '${e.packageName}',
  appName: '${e.appName}',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      style: 'DARK',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    }
  }
};

export default config;
`});const o=t.findIndex(a=>a.path==="app/build.gradle");if(o!==-1){const a=t[o].content;t[o]={path:"app/build.gradle",content:a.replace('androidTestImplementation "androidx.test.espresso:espresso-core:$androidxEspressoCoreVersion"',`androidTestImplementation "androidx.test.espresso:espresso-core:$androidxEspressoCoreVersion"

    // Ionic Framework
    implementation 'com.google.android.material:material:1.11.0'`)}}return t},Ps=()=>`buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath 'com.android.tools.build:gradle:8.2.2'
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

task clean(type: Delete) {
    delete rootProject.buildDir
}
`,Is=e=>`rootProject.name = '${e}'
include ':app'
`,_s=e=>`plugins {
    id 'com.android.application'
}

android {
    namespace '${e}'
    compileSdk 34

    defaultConfig {
        applicationId "${e}"
        minSdk 24
        targetSdk 34
        versionCode 1
        versionName "1.0"

        manifestPlaceholders = [
            hostName: "",
            defaultUrl: "",
            launcherName: "${e}",
            assetStatements: '[]'
        ]
    }

    buildTypes {
        release {
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
}

dependencies {
    implementation 'com.google.androidbrowserhelper:androidbrowserhelper:2.5.0'
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'androidx.core:core-splashscreen:1.0.1'
}
`,Es=(e,t)=>{let s="";try{s=new URL(t).hostname}catch{}return`<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="${e}">

    <uses-permission android:name="android.permission.INTERNET" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme">

        <meta-data
            android:name="asset_statements"
            android:resource="@string/asset_statements" />

        <activity
            android:name="android.support.customtabs.trusted.LauncherActivity"
            android:exported="true"
            android:label="@string/app_name">
            <meta-data
                android:name="android.support.customtabs.trusted.DEFAULT_URL"
                android:value="${t}" />
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https" android:host="${s}" />
            </intent-filter>
        </activity>
    </application>
</manifest>
`},Ds=(e,t)=>{let s="";try{s=new URL(t).hostname}catch{}return`<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${e}</string>
    <string name="asset_statements">
        [{
            \\"relation\\": [\\"delegate_permission/common.handle_all_urls\\"],
            \\"target\\": {
                \\"namespace\\": \\"web\\",
                \\"site\\": \\"https://${s}\\"
            }
        }]
    </string>
</resources>
`},Rs=()=>`<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="Theme.AppCompat.Light.NoActionBar">
        <item name="colorPrimary">#FF6200EE</item>
        <item name="colorPrimaryDark">#FF3700B3</item>
        <item name="colorAccent">#FF03DAC5</item>
        <item name="android:windowBackground">@drawable/splash_screen</item>
    </style>
</resources>
`,Ts=e=>{const t=e.url||"https://example.com",s=At(e),o=s.findIndex(a=>a.path==="app/src/main/res/values/strings.xml");return o!==-1&&(s[o]={path:"app/src/main/res/values/strings.xml",content:Ds(e.appName,t)}),[...s,{path:"build.gradle",content:Ps()},{path:"settings.gradle",content:Is(e.appName)},{path:"app/build.gradle",content:_s(e.packageName)},{path:"app/src/main/AndroidManifest.xml",content:Es(e.packageName,t)},{path:"app/src/main/res/values/styles.xml",content:Rs()}]};function $s(e){return`const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    titleBarStyle: 'hiddenInset',
    show: false,
  });

  ${e?`mainWindow.loadURL('${e}');`:"mainWindow.loadFile(path.join(__dirname, 'www', 'index.html'));"}

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
`}function Os(){return`const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
  send: (channel, data) => {
    const validChannels = ['app:minimize', 'app:maximize', 'app:close'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
});
`}function Ms(e,t,s){const o={};s.includes("windows")&&(o.win={target:["nsis"],icon:"assets/icon.png"},o.nsis={oneClick:!0,perMachine:!1,allowToChangeInstallationDirectory:!1}),s.includes("macos")&&(o.mac={target:["dmg"],category:"public.app-category.utilities",identity:null},o.dmg={writeUpdateInfo:!1}),s.includes("linux")&&(o.linux={target:["AppImage"],icon:"assets/icon.png",category:"Utility"});const a={name:t.replace(/\./g,"-"),version:"1.0.0",description:e,main:"main.js",scripts:{start:"electron .","build:win":"electron-builder --win","build:mac":"electron-builder --mac","build:linux":"electron-builder --linux","build:all":"electron-builder --win --mac --linux"},build:{appId:t,productName:e,directories:{output:"dist-electron"},files:["main.js","preload.js","www/**/*","assets/**/*"],...o},devDependencies:{electron:"^33.0.0","electron-builder":"^25.1.0"}};return JSON.stringify(a,null,2)}function Fs(e){return`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${e}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #0f0f0f; color: #fff; }
    .container { text-align: center; }
    h1 { font-size: 2rem; margin-bottom: 0.5rem; }
    p { color: #888; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${e}</h1>
    <p>Desktop app powered by Electron</p>
    <p id="info"></p>
  </div>
  <script>
    if (window.electronAPI) {
      document.getElementById('info').textContent = 
        'Electron ' + window.electronAPI.versions.electron + ' | Node ' + window.electronAPI.versions.node;
    }
  <\/script>
</body>
</html>`}function Bs(e){const{appName:t,packageName:s,url:o,platforms:a=["windows","macos","linux"]}=e,r=[];return r.push({path:"main.js",content:$s(o)}),r.push({path:"preload.js",content:Os()}),r.push({path:"package.json",content:Ms(t,s,a)}),o||r.push({path:"www/index.html",content:Fs(t)}),r.push({path:"README.md",content:`# ${t}

Desktop app built with Electron via NativeBridge.

## Development

\`\`\`bash
npm install
npm start
\`\`\`

## Build

\`\`\`bash
npm run build:all
\`\`\`
`}),r}const Us={push:{id:"push",permissions:["INTERNET","WAKE_LOCK","POST_NOTIFICATIONS"],gradleDeps:["implementation 'com.google.firebase:firebase-messaging:24.1.0'","implementation '@capacitor/push-notifications:6.0.0'"],imports:["import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;"],registrations:["registerPlugin(PushNotificationsPlugin.class);"]},camera:{id:"camera",permissions:["CAMERA","READ_MEDIA_IMAGES","READ_MEDIA_VIDEO"],gradleDeps:["implementation '@capacitor/camera:6.0.0'"],imports:["import com.capacitorjs.plugins.camera.CameraPlugin;"],registrations:["registerPlugin(CameraPlugin.class);"]},files:{id:"files",permissions:["READ_EXTERNAL_STORAGE","WRITE_EXTERNAL_STORAGE","READ_MEDIA_IMAGES"],gradleDeps:["implementation '@capacitor/filesystem:6.0.0'"],imports:["import com.capacitorjs.plugins.filesystem.FilesystemPlugin;"],registrations:["registerPlugin(FilesystemPlugin.class);"]},geo:{id:"geo",permissions:["ACCESS_FINE_LOCATION","ACCESS_COARSE_LOCATION"],gradleDeps:["implementation '@capacitor/geolocation:6.0.0'"],imports:["import com.capacitorjs.plugins.geolocation.GeolocationPlugin;"],registrations:["registerPlugin(GeolocationPlugin.class);"]},biometrics:{id:"biometrics",permissions:["USE_BIOMETRIC","USE_FINGERPRINT"],gradleDeps:[],imports:[],registrations:[]},"local-notif":{id:"local-notif",permissions:["POST_NOTIFICATIONS","SCHEDULE_EXACT_ALARM"],gradleDeps:["implementation '@capacitor/local-notifications:6.0.0'"],imports:["import com.capacitorjs.plugins.localnotifications.LocalNotificationsPlugin;"],registrations:["registerPlugin(LocalNotificationsPlugin.class);"]},"in-app-browser":{id:"in-app-browser",permissions:["INTERNET"],gradleDeps:["implementation '@capacitor/browser:6.0.0'"],imports:["import com.capacitorjs.plugins.browser.BrowserPlugin;"],registrations:["registerPlugin(BrowserPlugin.class);"]},share:{id:"share",permissions:[],gradleDeps:["implementation '@capacitor/share:6.0.0'"],imports:["import com.capacitorjs.plugins.share.SharePlugin;"],registrations:["registerPlugin(SharePlugin.class);"]},haptics:{id:"haptics",permissions:["VIBRATE"],gradleDeps:["implementation '@capacitor/haptics:6.0.0'"],imports:["import com.capacitorjs.plugins.haptics.HapticsPlugin;"],registrations:["registerPlugin(HapticsPlugin.class);"]},clipboard:{id:"clipboard",permissions:[],gradleDeps:["implementation '@capacitor/clipboard:6.0.0'"],imports:["import com.capacitorjs.plugins.clipboard.ClipboardPlugin;"],registrations:["registerPlugin(ClipboardPlugin.class);"]},network:{id:"network",permissions:["ACCESS_NETWORK_STATE"],gradleDeps:["implementation '@capacitor/network:6.0.0'"],imports:["import com.capacitorjs.plugins.network.NetworkPlugin;"],registrations:["registerPlugin(NetworkPlugin.class);"]},device:{id:"device",permissions:[],gradleDeps:["implementation '@capacitor/device:6.0.0'"],imports:["import com.capacitorjs.plugins.device.DevicePlugin;"],registrations:["registerPlugin(DevicePlugin.class);"]},statusbar:{id:"statusbar",permissions:[],gradleDeps:["implementation '@capacitor/status-bar:6.0.0'"],imports:["import com.capacitorjs.plugins.statusbar.StatusBarPlugin;"],registrations:["registerPlugin(StatusBarPlugin.class);"]},keyboard:{id:"keyboard",permissions:[],gradleDeps:["implementation '@capacitor/keyboard:6.0.0'"],imports:["import com.capacitorjs.plugins.keyboard.KeyboardPlugin;"],registrations:["registerPlugin(KeyboardPlugin.class);"]},splash:{id:"splash",permissions:[],gradleDeps:["implementation '@capacitor/splash-screen:6.0.0'"],imports:["import com.capacitorjs.plugins.splashscreen.SplashScreenPlugin;"],registrations:["registerPlugin(SplashScreenPlugin.class);"]},"edge-to-edge":{id:"edge-to-edge",permissions:[],gradleDeps:['implementation "androidx.core:core:$androidxCoreVersion"'],imports:["import androidx.core.view.WindowCompat;"],registrations:["WindowCompat.setDecorFitsSystemWindows(getWindow(), false);"]},storage:{id:"storage",permissions:[],gradleDeps:["implementation '@capacitor/preferences:6.0.0'"],imports:["import com.capacitorjs.plugins.preferences.PreferencesPlugin;"],registrations:["registerPlugin(PreferencesPlugin.class);"]},"google-auth":{id:"google-auth",permissions:["INTERNET"],gradleDeps:["implementation 'com.google.android.gms:play-services-auth:21.0.0'"],imports:[],registrations:[]},"apple-auth":{id:"apple-auth",permissions:["INTERNET"],gradleDeps:[],imports:[],registrations:[]},microphone:{id:"microphone",permissions:["RECORD_AUDIO","MODIFY_AUDIO_SETTINGS"],gradleDeps:[],imports:[],registrations:[]},barcode:{id:"barcode",permissions:["CAMERA"],gradleDeps:["implementation 'com.google.mlkit:barcode-scanning:17.3.0'"],imports:[],registrations:[]},bluetooth:{id:"bluetooth",permissions:["BLUETOOTH","BLUETOOTH_ADMIN","BLUETOOTH_SCAN","BLUETOOTH_CONNECT"],gradleDeps:[],imports:[],registrations:[]},sms:{id:"sms",permissions:["SEND_SMS"],gradleDeps:[],imports:[],registrations:[]},iap:{id:"iap",permissions:["BILLING"],gradleDeps:["implementation 'com.android.billingclient:billing:7.0.0'"],imports:[],registrations:[]},"action-sheet":{id:"action-sheet",permissions:[],gradleDeps:[],imports:[],registrations:[]},"app-launcher":{id:"app-launcher",permissions:[],gradleDeps:[],imports:[],registrations:[]},cookies:{id:"cookies",permissions:["INTERNET"],gradleDeps:[],imports:[],registrations:[]},dialog:{id:"dialog",permissions:[],gradleDeps:[],imports:[],registrations:[]},motion:{id:"motion",permissions:[],gradleDeps:[],imports:[],registrations:[]},"screen-orientation":{id:"screen-orientation",permissions:[],gradleDeps:[],imports:[],registrations:[]},"screen-reader":{id:"screen-reader",permissions:[],gradleDeps:[],imports:[],registrations:[]},toast:{id:"toast",permissions:[],gradleDeps:[],imports:[],registrations:[]},"text-zoom":{id:"text-zoom",permissions:[],gradleDeps:[],imports:[],registrations:[]},"privacy-screen":{id:"privacy-screen",permissions:[],gradleDeps:[],imports:[],registrations:[]},"google-maps":{id:"google-maps",permissions:["INTERNET","ACCESS_FINE_LOCATION"],gradleDeps:["implementation 'com.google.android.gms:play-services-maps:19.0.0'"],imports:[],registrations:[]},"facebook-login":{id:"facebook-login",permissions:["INTERNET"],gradleDeps:["implementation 'com.facebook.android:facebook-login:17.0.0'"],imports:[],registrations:[]}},bt=e=>e.map(t=>Us[t]).filter(Boolean),Ls=e=>{const t=new Set;for(const s of bt(e))s.permissions.forEach(o=>t.add(o));return[...t]},Vs=(e,t)=>{const s=Ls(t),o=e.match(/android:name="android\.permission\.(\w+)"/g)||[],a=new Set(o.map(l=>l.match(/\.(\w+)"/)[1])),r=s.filter(l=>!a.has(l)).map(l=>`    <uses-permission android:name="android.permission.${l}" />`).join(`
`);return r?e.replace(/(<uses-permission[^/]*\/>)\s*\n(\s*<application)/,`$1
${r}

$2`):e},Ws=(e,t)=>{const s=bt(t).flatMap(r=>r.gradleDeps).filter(Boolean);if(s.length===0)return e;const o=s.map(r=>`    ${r}`).join(`
`);return e.replace(/(dependencies\s*\{[^}]*)(})/,`$1
    // NativeBridge Plugin Dependencies
${o}
$2`)},Gs=(e,t)=>{const s=bt(t);if(s.length===0)return e;const o=s.flatMap(l=>l.imports).filter(Boolean),a=s.flatMap(l=>l.registrations).filter(Boolean);let r=e;if(o.length>0){const l=`
`+o.join(`
`);r=r.replace(/(import com\.getcapacitor\.BridgeActivity;)/,`$1${l}`)}if(a.length>0){const l=a.map(b=>`        ${b}`).join(`
`);r=r.replace(/(super\.onCreate\(savedInstanceState\);)/,`$1

        // Plugins
${l}`)}return r},Qt=[{name:"mdpi",size:48,folder:"mipmap-mdpi"},{name:"hdpi",size:72,folder:"mipmap-hdpi"},{name:"xhdpi",size:96,folder:"mipmap-xhdpi"},{name:"xxhdpi",size:144,folder:"mipmap-xxhdpi"},{name:"xxxhdpi",size:192,folder:"mipmap-xxxhdpi"}],Et=(e,t,s)=>new Promise(o=>{const a=document.createElement("canvas");a.width=t,a.height=t;const r=a.getContext("2d");s&&(r.beginPath(),r.arc(t/2,t/2,t/2,0,Math.PI*2),r.closePath(),r.clip()),r.drawImage(e,0,0,t,t),a.toBlob(l=>{l.arrayBuffer().then(o)},"image/png")}),zs=e=>new Promise((t,s)=>{const o=new Image;o.onload=()=>t(o),o.onerror=s,o.src=e}),Dt=async e=>{const t=await zs(e),s=[];for(const o of Qt){const[a,r]=await Promise.all([Et(t,o.size,!1),Et(t,o.size,!0)]);s.push({folder:o.folder,squareBlob:a,roundBlob:r})}return s},Rt=async(e,t="#4285F4")=>{const s=(e[0]||"A").toUpperCase(),o=[];for(const a of Qt){const[r,l]=await Promise.all([Tt(s,a.size,t,!1),Tt(s,a.size,t,!0)]);o.push({folder:a.folder,squareBlob:r,roundBlob:l})}return o},Tt=(e,t,s,o)=>new Promise(a=>{const r=document.createElement("canvas");r.width=t,r.height=t;const l=r.getContext("2d");if(o)l.beginPath(),l.arc(t/2,t/2,t/2,0,Math.PI*2),l.closePath(),l.fillStyle=s,l.fill();else{const b=t*.15;l.beginPath(),l.roundRect(0,0,t,t,b),l.fillStyle=s,l.fill()}l.fillStyle="#FFFFFF",l.font=`bold ${t*.5}px sans-serif`,l.textAlign="center",l.textBaseline="middle",l.fillText(e,t/2,t/2+t*.03),r.toBlob(b=>{b.arrayBuffer().then(a)},"image/png")});function Hs(e){var N,c,p,S,u;const t=di(e),s={framework:t.shape==="plain-html"?"static":t.framework.toLowerCase().includes("react")?"react":t.framework.toLowerCase().includes("vue")?"vue":t.framework.toLowerCase().includes("angular")?"angular":t.framework.toLowerCase().includes("svelte")?"svelte":t.framework.toLowerCase().includes("next")?"next":t.framework.toLowerCase().includes("nuxt")?"nuxt":t.shape==="unknown"?"unknown":"vanilla",packageManager:t.packageManager,hasPackageJson:t.hasPackageJson,hasBuildScript:t.hasBuildScript,buildScript:t.hasBuildScript?t.buildCommand.replace(/^npm run /,""):null,outputDir:t.outputDir,entryPoint:t.entryHtml,hasTypeScript:!1,hasSSR:!1,totalFiles:e.length,sourceFiles:0,dependencies:t.dependencies,devDependencies:t.devDependencies,warnings:[...t.warnings,...t.remediations.map(x=>`Grounding: ${x}`)],lockFile:null,isMonorepo:t.isMonorepo,workspacePackages:[],entryCandidates:pi(e)},o=e.filter(x=>x.type==="file").map(x=>x.path);s.sourceFiles=o.length,o.some(x=>x.endsWith("bun.lockb")||x.endsWith("bun.lock"))?(s.packageManager="bun",s.lockFile="bun.lockb"):o.some(x=>x.endsWith("pnpm-lock.yaml"))?(s.packageManager="pnpm",s.lockFile="pnpm-lock.yaml"):o.some(x=>x.endsWith("yarn.lock"))?(s.packageManager="yarn",s.lockFile="yarn.lock"):o.some(x=>x.endsWith("package-lock.json"))&&(s.packageManager="npm",s.lockFile="package-lock.json");const a=t.projectRoot?`${t.projectRoot}/package.json`:"package.json",r=e.find(x=>x.path===a);if(r!=null&&r.content)try{const y=JSON.parse(r.content).scripts||{};y.build?(s.hasBuildScript=!0,s.buildScript=y.build):y["build:prod"]&&(s.hasBuildScript=!0,s.buildScript=y["build:prod"]);const I={...s.dependencies,...s.devDependencies};I.next?s.framework="next":I.nuxt||I.nuxt3?s.framework="nuxt":I["@angular/core"]?s.framework="angular":I.svelte||I["@sveltejs/kit"]?s.framework="svelte":I.vue?s.framework="vue":I.react&&(s.framework="react")}catch{s.warnings.push("package.json exists but could not be parsed")}else s.framework!=="static"&&(o.some(y=>/\.html?$/i.test(y)&&!/(^|\/)(node_modules|dist|build|www|android|ios)(\/|$)/.test(y))?(s.framework="static",s.warnings.push("Static HTML project detected — Capacitor scaffolding will be auto-generated")):s.warnings.push("No package.json found — build may fail"));s.hasTypeScript=o.some(x=>x.endsWith(".ts")||x.endsWith(".tsx")||x==="tsconfig.json"),(s.framework==="next"||s.framework==="nuxt")&&(s.hasSSR=!0,s.warnings.push(`${s.framework} uses SSR by default — ensure static export is configured for native builds`)),s.framework==="static"?s.outputDir=s.outputDir||"www":(N=s.buildScript)!=null&&N.includes("vite")?s.outputDir="dist":s.framework==="react"?s.outputDir="build":s.framework==="angular"||s.framework==="vue"?s.outputDir="dist":s.framework==="next"?s.outputDir="out":s.outputDir=s.outputDir||"dist";const l=["src/main.tsx","src/main.ts","src/index.tsx","src/index.ts","src/App.tsx","src/app.tsx","index.html"];s.entryPoint=s.entryPoint||l.find(x=>o.some(y=>y.endsWith(x)))||null;const b=o.some(x=>x==="pnpm-workspace.yaml"||x.endsWith("/pnpm-workspace.yaml")),g=o.some(x=>x==="turbo.json"||x.endsWith("/turbo.json"));let P=null;if(r!=null&&r.content)try{const x=JSON.parse(r.content);Array.isArray(x.workspaces)?P=x.workspaces:(c=x.workspaces)!=null&&c.packages&&(P=x.workspaces.packages)}catch{}if(s.isMonorepo=b||g||!!P,s.isMonorepo){const x=e.filter(y=>y.type==="file"&&y.path!=="package.json"&&y.path.endsWith("/package.json")&&!y.path.includes("node_modules/"));for(const y of x)try{const I=JSON.parse(y.content||"{}"),w=y.path.replace(/\/package\.json$/,""),v=((p=I.scripts)==null?void 0:p.build)||((S=I.scripts)==null?void 0:S["build:prod"])||null;let H=null;v!=null&&v.includes("vite")?H="dist":(u=I.dependencies)!=null&&u.next?H="out":H="dist",s.workspacePackages.push({path:w,name:I.name||w,buildScript:v,outputDir:H})}catch{}}return s}function Js(e){const t=[];t.push(`Framework: ${e.framework}`),t.push(`Package manager: ${e.packageManager}`),t.push(`Files: ${e.sourceFiles} source files`),e.hasBuildScript&&t.push(`Build script: ${e.buildScript}`),e.outputDir&&t.push(`Expected output: ${e.outputDir}/`),e.hasTypeScript&&t.push("TypeScript: yes"),e.entryPoint&&t.push(`Entry point: ${e.entryPoint}`);for(const s of e.warnings)t.push(`⚠ ${s}`);return t}function Ks(e,t,s){var l;const o={compatible:!0,score:100,blockers:[],warnings:[],suggestions:[]},a=e.framework==="static"||!e.hasPackageJson&&!!((l=e.entryPoint)!=null&&l.endsWith("index.html"));!e.hasPackageJson&&!a?(o.blockers.push("No package.json found — cannot install dependencies"),o.score-=50):a&&!e.hasPackageJson&&(o.warnings.push("Static HTML project — package.json and dist output will be synthesized"),o.score-=5),!e.hasBuildScript&&!a&&(o.blockers.push("No build script in package.json — project cannot be compiled"),o.score-=40),e.hasSSR&&(o.warnings.push(`${e.framework} uses SSR — native builds require static HTML output`),o.score-=15,e.framework==="next"?o.suggestions.push(`Add 'output: "export"' to next.config.js for static HTML generation`):e.framework==="nuxt"&&o.suggestions.push("Use 'nuxt generate' instead of 'nuxt build' for static output"));const r=["sharp","canvas","node-gyp","better-sqlite3","bcrypt"];for(const b of r)(e.dependencies[b]||e.devDependencies[b])&&(o.warnings.push(`'${b}' is a native Node module — it won't work in a mobile WebView`),o.score-=10);return(t==="capacitor"||t==="ionic")&&e.framework==="unknown"&&!e.hasBuildScript&&!a&&(o.blockers.push("Capacitor requires a web project with a build step"),o.score-=30),(t==="webview"||t==="twa")&&(o.score=Math.max(o.score,80)),e.sourceFiles===0&&(o.blockers.push("No source files uploaded"),o.score=0),o.compatible=o.blockers.length===0,o.score=Math.max(0,o.score),o}function qs(e){const t=[];t.push(`Compatibility score: ${e.score}/100`),e.compatible?t.push("✓ Project is compatible with target engine"):t.push("✗ Project has blocking compatibility issues:");for(const s of e.blockers)t.push(`  ✗ ${s}`);for(const s of e.warnings)t.push(`  ⚠ ${s}`);for(const s of e.suggestions)t.push(`  → ${s}`);return t}function Zs(e){const t={installCommand:"npm install",flags:["--legacy-peer-deps"],preInstallActions:[],warnings:[],peerConflicts:[]};(e.packageManager==="bun"||e.lockFile==="bun.lockb")&&(t.preInstallActions.push("rm -f bun.lockb bun.lock"),t.warnings.push("Bun lockfile removed — using npm in CI for broader compatibility"));const s={...e.dependencies,...e.devDependencies};return s.react&&s.react.includes("19")&&(t.peerConflicts.push("React 19 detected — some packages may not support it yet"),t.flags.push("--legacy-peer-deps")),e.lockFile==="package-lock.json"&&t.warnings.push("Using existing package-lock.json — if it references private registries, build may fail"),(s.lerna||s.turbo||s.nx)&&t.warnings.push("Monorepo detected — ensure the correct workspace package is being built"),t.installCommand=`npm install ${t.flags.join(" ")}`.trim(),t}function Xs(e){const t=[];if(e.preInstallActions.length>0)for(const s of e.preInstallActions)t.push(`Pre-install: ${s}`);t.push(`Install command: ${e.installCommand}`);for(const s of e.warnings)t.push(`⚠ ${s}`);for(const s of e.peerConflicts)t.push(`⚠ Peer conflict: ${s}`);return t}const $t={camera:{importStatement:"import { Camera } from '@capacitor/camera';",initCode:"// Camera is auto-registered by Capacitor",permissions:["CAMERA","READ_EXTERNAL_STORAGE","WRITE_EXTERNAL_STORAGE"],notes:["Camera permission will be requested at runtime"]},geolocation:{importStatement:"import { Geolocation } from '@capacitor/geolocation';",initCode:"// Geolocation is auto-registered by Capacitor",permissions:["ACCESS_FINE_LOCATION","ACCESS_COARSE_LOCATION"],notes:["Location permission required — add a rationale for App Store review"]},"push-notifications":{importStatement:"import { PushNotifications } from '@capacitor/push-notifications';",initCode:`
// Register push notifications
PushNotifications.requestPermissions().then(result => {
  if (result.receive === 'granted') {
    PushNotifications.register();
  }
});
PushNotifications.addListener('registration', token => {
  console.log('Push token:', token.value);
});
PushNotifications.addListener('pushNotificationReceived', notification => {
  console.log('Push received:', notification);
});`,permissions:["POST_NOTIFICATIONS"],notes:["Requires google-services.json for Firebase Cloud Messaging","Add FCM server key to your backend"]},filesystem:{importStatement:"import { Filesystem } from '@capacitor/filesystem';",initCode:"// Filesystem is auto-registered by Capacitor",permissions:["READ_EXTERNAL_STORAGE","WRITE_EXTERNAL_STORAGE"],notes:[]},share:{importStatement:"import { Share } from '@capacitor/share';",initCode:"// Share is auto-registered by Capacitor",permissions:[],notes:[]},haptics:{importStatement:"import { Haptics } from '@capacitor/haptics';",initCode:"// Haptics is auto-registered by Capacitor",permissions:["VIBRATE"],notes:[]},"splash-screen":{importStatement:"import { SplashScreen } from '@capacitor/splash-screen';",initCode:`// Hide splash screen after app is ready
SplashScreen.hide();`,permissions:[],notes:[]},"status-bar":{importStatement:"import { StatusBar, Style } from '@capacitor/status-bar';",initCode:`// Configure status bar
StatusBar.setStyle({ style: Style.Dark });`,permissions:[],notes:[]},app:{importStatement:"import { App as CapApp } from '@capacitor/app';",initCode:`// Handle back button for Android
CapApp.addListener('backButton', ({ canGoBack }) => {
  if (canGoBack) { window.history.back(); }
  else { CapApp.exitApp(); }
});`,permissions:[],notes:["Back button handler auto-injected"]},preferences:{importStatement:"import { Preferences } from '@capacitor/preferences';",initCode:"// Preferences is auto-registered by Capacitor",permissions:[],notes:[]},network:{importStatement:"import { Network } from '@capacitor/network';",initCode:"// Network is auto-registered by Capacitor",permissions:["ACCESS_NETWORK_STATE"],notes:[]},clipboard:{importStatement:"import { Clipboard } from '@capacitor/clipboard';",initCode:"// Clipboard is auto-registered by Capacitor",permissions:[],notes:[]},device:{importStatement:"import { Device } from '@capacitor/device';",initCode:"// Device is auto-registered by Capacitor",permissions:[],notes:[]},keyboard:{importStatement:"import { Keyboard } from '@capacitor/keyboard';",initCode:"// Keyboard is auto-registered by Capacitor",permissions:[],notes:[]},"local-notifications":{importStatement:"import { LocalNotifications } from '@capacitor/local-notifications';",initCode:`// Request notification permissions
LocalNotifications.requestPermissions();`,permissions:["POST_NOTIFICATIONS"],notes:[]},browser:{importStatement:"import { Browser } from '@capacitor/browser';",initCode:"// Browser is auto-registered by Capacitor",permissions:[],notes:[]},"capawesome-biometrics":{importStatement:"import { Biometrics } from '@capawesome/capacitor-biometrics';",initCode:"// BiometricAuth is auto-registered by Capacitor",permissions:["USE_BIOMETRIC"],notes:["Ensure device has biometric hardware"]},"edge-to-edge":{importStatement:"",initCode:"",permissions:[],notes:["Edge-to-edge display is configured via Android theme and WindowInsetsCompat"]},barcode:{importStatement:"import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';",initCode:"// BarcodeScanner is auto-registered by Capacitor",permissions:["CAMERA"],notes:["ML Kit barcode scanning requires Google Play Services"]},"google-auth":{importStatement:"import { GoogleSignIn } from '@capawesome/capacitor-google-sign-in';",initCode:`// Initialize Google Sign-In (Capawesome)
await GoogleSignIn.initialize({ clientId: import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID });`,permissions:[],notes:["Set VITE_GOOGLE_WEB_CLIENT_ID in .env (your Web OAuth Client ID)","Android requires SHA-1 fingerprint added to OAuth client; iOS requires GIDClientID in Info.plist"]},microphone:{importStatement:"import { Microphone } from '@mozartec/capacitor-microphone';",initCode:"// Microphone is auto-registered by Capacitor",permissions:["RECORD_AUDIO"],notes:[]}};function Ys(e){var s;if(dt[e])return e;for(const[o,a]of Object.entries(dt))if(a.npm===e)return o;const t=(s=e.split("/").pop())==null?void 0:s.toLowerCase();return t&&dt[t]?t:null}function ei(e){const t=[],s=[];for(const o of e){const a=Ys(o);a?t.includes(a)||t.push(a):s.push(o)}return{resolved:t,unresolved:s}}function Qs(e,t,s){const o=[],a=[],r=[],{resolved:l,unresolved:b}=ei(t);for(const p of b)o.push(`Plugin '${p}' could not be resolved to a known plugin`);(s==="capacitor"||s==="ionic")&&!l.includes("app")&&l.push("app");const g=["src/main.tsx","src/main.ts","src/main.jsx","src/main.js","src/index.tsx","src/index.ts","src/index.jsx","src/index.js","src/App.tsx","src/App.ts","src/App.jsx","src/App.js","main.tsx","main.ts","index.tsx","index.ts"];let P="",N="";for(const p of g){const S=e.find(u=>u.path===p||u.path.endsWith("/"+p));if(S!=null&&S.content){P=S.path,N=S.content;break}}if(!P){const p=e.find(S=>{var u,x;return((u=S.content)==null?void 0:u.includes("import React"))||((x=S.content)==null?void 0:x.includes("from 'react'"))});p!=null&&p.content&&(P=p.path,N=p.content)}if(!P)return o.push("No entry point found for plugin injection"),{targetFile:"",injections:[],modifiedSource:null,warnings:o,summary:["No entry point found"]};a.push(`Entry point: ${P}`);for(const p of l){const S=dt[p];if(!S){const x=$t[p];x&&r.push({pluginId:p,npmPackage:"",importStatement:x.importStatement,initCode:x.initCode,androidPermissions:x.permissions,notes:x.notes});continue}if(!S.engines.includes(s)){o.push(`Plugin '${p}' does not support engine '${s}'`);continue}const u=$t[p];if(!u){r.push({pluginId:p,npmPackage:S.npm,importStatement:`// ${S.npm} — auto-registered by Capacitor`,initCode:"",androidPermissions:S.permissions||[],notes:[]});continue}r.push({pluginId:p,npmPackage:S.npm,importStatement:u.importStatement,initCode:u.initCode,androidPermissions:u.permissions,notes:u.notes})}let c=null;if(r.length>0&&N){const p=r.filter(u=>u.importStatement&&!u.importStatement.startsWith("//")&&!N.includes(u.importStatement)).map(u=>u.importStatement),S=r.filter(u=>u.initCode&&u.initCode.trim()!==""&&!u.initCode.includes("auto-registered")).map(u=>u.initCode);if(p.length>0||S.length>0){const u=N.split(`
`);let x=-1;for(let v=0;v<u.length;v++)(u[v].startsWith("import ")||u[v].startsWith("import{"))&&(x=v);const y=x+1,I=p.length>0?[`
// Capacitor Plugin Imports (auto-injected by NativeBridge)`,...p]:[],w=S.length>0?[`
// Capacitor Plugin Initialization (auto-injected by NativeBridge)`,...S,""]:[];u.splice(y,0,...I,...w),c=u.join(`
`),a.push(`Injected ${p.length} import(s) and ${S.length} init block(s)`)}else a.push("All plugin code already present in source")}if(a.push(`${r.length} plugin(s) configured`),r.some(p=>p.androidPermissions.length>0)){const p=[...new Set(r.flatMap(S=>S.androidPermissions))];a.push(`Android permissions: ${p.join(", ")}`)}return{targetFile:P,injections:r,modifiedSource:c,warnings:o,summary:a}}function eo(e,t){const s=[];return e.modifiedSource&&e.targetFile&&(t(e.targetFile,e.modifiedSource),s.push(e.targetFile)),s}function to(e){const t=[];t.push("── Plugin Code Injection ──");for(const s of e.summary)t.push(s);for(const s of e.injections){t.push(`  • ${s.pluginId} → ${s.npmPackage||"(built-in)"}`);for(const o of s.notes)t.push(`    ℹ ${o}`)}for(const s of e.warnings)t.push(`⚠ ${s}`);return t}function vt(e,t){const s={npmPackages:[],permissions:[],gradleDeps:[],codeInjections:[],manifestEntries:[],warnings:[],unsupportedPlugins:[]};if(e.length===0)return s;const{resolved:o,unresolved:a}=ei(e);for(const b of a)s.unsupportedPlugins.push(b),s.warnings.push(`Plugin '${b}' is not in the plugin registry`);const r=new Set;for(const b of o){const g=dt[b];if(!g){s.unsupportedPlugins.push(b),s.warnings.push(`Plugin '${b}' is not in the plugin registry`);continue}if(!g.engines.includes(t)){s.warnings.push(`Plugin '${b}' (${g.npm}) does not support engine '${t}'`);continue}s.npmPackages.push(g.npm)}const l=bt(o);for(const b of l){for(const g of b.permissions)r.add(g);for(const g of b.gradleDeps)s.gradleDeps.push(g);for(const g of b.imports)s.codeInjections.push({file:"MainActivity.java",type:"import",code:g});for(const g of b.registrations)s.codeInjections.push({file:"MainActivity.java",type:"registration",code:g});for(const g of b.permissions)s.manifestEntries.push(`<uses-permission android:name="android.permission.${g}" />`)}return s.permissions=[...r],o.includes("push")&&s.warnings.push("Push Notifications requires a google-services.json file for Firebase Cloud Messaging"),o.includes("google-auth")&&s.warnings.push("Google Auth requires OAuth client ID configuration in the Google Cloud Console"),s}function Ot(e){const t=[];if(e.npmPackages.length>0){t.push(`Plugins to install: ${e.npmPackages.length}`);for(const s of e.npmPackages)t.push(`  • ${s}`)}e.permissions.length>0&&t.push(`Permissions required: ${e.permissions.join(", ")}`),e.codeInjections.length>0&&t.push(`Code injections: ${e.codeInjections.length} entries`);for(const s of e.warnings)t.push(`⚠ ${s}`);for(const s of e.unsupportedPlugins)t.push(`✗ Unknown plugin: ${s}`);return t}function io(){const e=Zt;return{variablesGradle:Xt(e),agpVersion:e.agpVersion,gradleVersion:e.gradleVersion,capacitorVersion:e.capacitorVersion,jdkVersion:e.jdkVersion,compileSdk:e.compileSdk,targetSdk:e.targetSdk,minSdk:e.minSdk}}function so(e){return[`Capacitor: ${e.capacitorVersion}`,`compileSdk: ${e.compileSdk} | targetSdk: ${e.targetSdk} | minSdk: ${e.minSdk}`,`AGP: ${e.agpVersion} | Gradle: ${e.gradleVersion} | JDK: ${e.jdkVersion}`]}async function oo(e,t,s){const o=[],a=[],r=[],l=Object.keys(e.files).find(N=>N.endsWith(".apk"));if(!l)return{valid:!1,apkFound:!1,apkSizeBytes:0,checks:[{id:"apk-present",label:"APK file",status:"fail",detail:"No .apk file found in build artifact"}],warnings:a,errors:["No APK file found in the build artifact ZIP"]};const b=await e.files[l].async("arraybuffer"),g=b.byteLength;o.push({id:"apk-present",label:"APK file",status:"pass",detail:`Found: ${l} (${(g/(1024*1024)).toFixed(1)} MB)`}),g<500*1024?(o.push({id:"apk-size",label:"APK size",status:"warn",detail:`APK is very small (${(g/1024).toFixed(0)} KB) — may be incomplete`}),a.push("APK file is suspiciously small. The build may have failed partially.")):g>100*1024*1024?(o.push({id:"apk-size",label:"APK size",status:"warn",detail:`APK is very large (${(g/(1024*1024)).toFixed(0)} MB)`}),a.push("APK exceeds 100MB. Consider enabling ProGuard or splitting APKs.")):o.push({id:"apk-size",label:"APK size",status:"pass",detail:`${(g/(1024*1024)).toFixed(1)} MB — within normal range`});try{const N=await st.loadAsync(b),c=Object.keys(N.files),p=c.some(v=>v==="AndroidManifest.xml");o.push({id:"manifest",label:"AndroidManifest.xml",status:p?"pass":"fail",detail:p?"Manifest found in APK":"AndroidManifest.xml missing from APK"}),p||r.push("AndroidManifest.xml not found in APK");const S=c.some(v=>v.endsWith(".dex"));o.push({id:"dex",label:"Compiled code (DEX)",status:S?"pass":"fail",detail:S?`DEX files found (${c.filter(v=>v.endsWith(".dex")).length} file(s))`:"No DEX files — app has no compiled code"}),S||r.push("No DEX files found. The APK may be empty or corrupted.");const u=c.some(v=>v==="resources.arsc");o.push({id:"resources",label:"Resources",status:u?"pass":"warn",detail:u?"Resource table found":"resources.arsc missing — app may lack UI resources"});const x=["mdpi","hdpi","xhdpi","xxhdpi","xxxhdpi"],y=x.filter(v=>c.some(H=>H.includes(`mipmap-${v}`)||H.includes(`drawable-${v}`)));if(y.length>=3?o.push({id:"icons",label:"App icons",status:"pass",detail:`Icons found for ${y.length}/${x.length} densities (${y.join(", ")})`}):y.length>0?(o.push({id:"icons",label:"App icons",status:"warn",detail:`Only ${y.length} icon densities found. Some devices may show blurry icons.`}),a.push(`Only ${y.length} icon density buckets present. Recommended: at least 3.`)):(o.push({id:"icons",label:"App icons",status:"warn",detail:"No density-specific icons found. Default Android icon will be used."}),a.push("No app icons found in the APK.")),c.some(v=>v.includes("assets/public/index.html")||v.includes("assets/public/")||v.includes("assets/www/")))o.push({id:"web-assets",label:"Web assets",status:"pass",detail:"Web app files found in APK assets"});else{const v=c.some(H=>H.startsWith("assets/"));o.push({id:"web-assets",label:"Web assets",status:"warn",detail:v?"Assets directory exists but no index.html found":"No assets directory — may be a URL-mode app"})}const w=c.some(v=>v.startsWith("META-INF/")&&(v.endsWith(".RSA")||v.endsWith(".SF")||v.endsWith(".DSA")));o.push({id:"signing",label:"APK signing",status:w?"pass":"warn",detail:w?"APK is signed":"No signature found — APK may be unsigned (debug build)"})}catch{o.push({id:"apk-integrity",label:"APK integrity",status:"fail",detail:"APK file is not a valid ZIP archive — may be corrupted"}),r.push("APK file could not be opened as a ZIP archive.")}return{valid:!o.some(N=>N.status==="fail"),apkFound:!0,apkSizeBytes:g,checks:o,warnings:a,errors:r}}function no(e){const t=[];t.push("── APK Validation ──");for(const s of e.checks){const o=s.status==="pass"?"✓":s.status==="warn"?"⚠":"✗";t.push(`${o} ${s.label}: ${s.detail}`)}if(e.warnings.length>0)for(const s of e.warnings)t.push(`⚠ ${s}`);if(e.errors.length>0)for(const s of e.errors)t.push(`✗ ${s}`);return t.push(e.valid?"✓ APK validation passed":"✗ APK validation failed"),t}function ao(e){const t=[],s=e.split(`
`).filter(l=>l.trim().startsWith("import ")),o=new Set;for(const l of s){const b=l.trim();o.has(b)&&t.push(`Duplicate import: ${b}`),o.add(b)}let a=0,r=0;for(const l of e)l==="{"&&a++,l==="}"&&a--,l==="("&&r++,l===")"&&r--;return a!==0&&t.push(`Mismatched braces (${a>0?"unclosed":"extra closing"})`),r!==0&&t.push(`Mismatched parentheses (${r>0?"unclosed":"extra closing"})`),{valid:t.length===0,issues:t}}const ut={setup:{label:"Establishing infrastructure",description:"Provision Ubuntu runners, install Node & JDK, prepare workspace"},"ai-wiring":{label:"AI Code Integration",description:"AI scans code, injects plugin code, modifies files"},build:{label:"Build & Deliver",description:"Compile with Gradle, sign and deliver the installer"}},_e={scan:{label:"Scanning project structure",estimatedSeconds:2,macroPhase:"setup"},compatibility:{label:"Checking compatibility",estimatedSeconds:1,macroPhase:"setup"},dependencies:{label:"Installing dependencies",estimatedSeconds:18,macroPhase:"setup"},plugins:{label:"Installing plugins",estimatedSeconds:12,macroPhase:"setup"},config:{label:"Generating configuration",estimatedSeconds:1,macroPhase:"setup"},"ai-inject":{label:"AI code integration",estimatedSeconds:5,macroPhase:"ai-wiring"},bundle:{label:"Bundling source code",estimatedSeconds:3,macroPhase:"build"},upload:{label:"Dispatching to build runners",estimatedSeconds:5,macroPhase:"build"},build:{label:"Building with Gradle",estimatedSeconds:120,macroPhase:"build"}};async function ro(e,t,s,o,a={}){var y;const r=ui(t),l=await mi(e),b=["scan","compatibility","dependencies","plugins","config","ai-inject","bundle","upload","build"],g=(I,w)=>b.map(v=>({phase:v,macroPhase:_e[v].macroPhase,label:_e[v].label,required:I,reason:l?"Force full build requested":"First build for this project",estimatedSeconds:_e[v].estimatedSeconds}));if(a.forceFullBuild||!l){const I=g(!0);return{steps:I,isIncremental:!1,previousSnapshot:l,currentHash:r,skippedPhases:[],totalEstimatedSeconds:I.reduce((w,v)=>w+v.estimatedSeconds,0),macroPhases:Mt(I)}}const P=r!==l.file_hash,N=l.plugin_state||[],c=JSON.stringify([...s].sort())!==JSON.stringify([...N].sort()),S=((y=l.config_state)==null?void 0:y.engine)!==o,u=[],x=[];for(const I of b){let w=!0,v="Required for build";const H=_e[I].macroPhase;switch(I){case"scan":w=P||S,v=w?"Source code changed":"Source unchanged — skipping";break;case"compatibility":w=P||S,v=w?"Verifying compatibility":"Already verified";break;case"dependencies":w=P,v=w?"Dependencies may have changed":"Dependencies unchanged";break;case"plugins":w=c,v=w?"Plugin configuration changed":"Plugins unchanged";break;case"config":w=c||S,v=w?"Config needs regeneration":"Config unchanged";break;case"ai-inject":w=c||P,v=w?"Code injection needed for changes":"No injection needed";break;case"bundle":case"upload":case"build":v="Required for every build";break}w?u.push({phase:I,macroPhase:H,label:_e[I].label,required:!0,reason:v,estimatedSeconds:_e[I].estimatedSeconds}):(x.push(I),u.push({phase:I,macroPhase:H,label:_e[I].label,required:!1,reason:v,estimatedSeconds:0}))}return{steps:u,isIncremental:x.length>0,previousSnapshot:l,currentHash:r,skippedPhases:x,totalEstimatedSeconds:u.filter(I=>I.required).reduce((I,w)=>I+w.estimatedSeconds,0),macroPhases:Mt(u)}}function Mt(e){return["setup","ai-wiring","build"].map(s=>{const o=e.filter(a=>a.macroPhase===s);return{id:s,label:ut[s].label,description:ut[s].description,steps:o,estimatedSeconds:o.reduce((a,r)=>a+r.estimatedSeconds,0)}})}class lo{constructor(){nt(this,"listeners",[]);nt(this,"macroListeners",[]);nt(this,"phaseTimers",new Map);nt(this,"macroTimers",new Map);nt(this,"_activeMacroPhase",null)}get activeMacroPhase(){return this._activeMacroPhase}on(t){return this.listeners.push(t),()=>{this.listeners=this.listeners.filter(s=>s!==t)}}onMacroPhase(t){return this.macroListeners.push(t),()=>{this.macroListeners=this.macroListeners.filter(s=>s!==t)}}emit(t){for(const s of this.listeners)try{s(t)}catch(o){console.error("Orchestrator listener error:",o)}}emitMacro(t){for(const s of this.macroListeners)try{s(t)}catch(o){console.error("Orchestrator macro listener error:",o)}}startMacroPhase(t){this._activeMacroPhase=t,this.macroTimers.set(t,Date.now()),this.emitMacro({macroPhase:t,status:"start",label:ut[t].label})}completeMacroPhase(t,s){const o=this.macroTimers.get(t),a=o?(Date.now()-o)/1e3:0;this.emitMacro({macroPhase:t,status:"complete",label:ut[t].label,detail:s,elapsed:a}),this._activeMacroPhase===t&&(this._activeMacroPhase=null)}errorMacroPhase(t,s){const o=this.macroTimers.get(t),a=o?(Date.now()-o)/1e3:0;this.emitMacro({macroPhase:t,status:"error",label:ut[t].label,detail:s,elapsed:a}),this._activeMacroPhase===t&&(this._activeMacroPhase=null)}startPhase(t,s){this.phaseTimers.set(t,Date.now()),this.emit({phase:t,macroPhase:_e[t].macroPhase,status:"start",label:s||_e[t].label})}completePhase(t,s){const o=this.phaseTimers.get(t),a=o?(Date.now()-o)/1e3:0;this.emit({phase:t,macroPhase:_e[t].macroPhase,status:"complete",label:_e[t].label,detail:s,elapsed:a})}skipPhase(t,s){this.emit({phase:t,macroPhase:_e[t].macroPhase,status:"skip",label:_e[t].label,detail:s})}errorPhase(t,s){const o=this.phaseTimers.get(t),a=o?(Date.now()-o)/1e3:0;this.emit({phase:t,macroPhase:_e[t].macroPhase,status:"error",label:_e[t].label,detail:s,elapsed:a})}}const co="spacer-fade",Ft=[{id:"spacer-fade",label:"Safe spacer + fade",tagline:"For websites never designed for edge-to-edge",description:"Draws behind the system bars, then adds a top spacer exactly the height of the status bar. The spacer is painted with the app's own background colour (re-read at runtime, so it follows light/dark mode) and fades out into the content below — the modern look. Content is pushed down so nothing hides under the status bar. The gesture/navigation area gets a matching bottom inset only when the device reports one, so swipe-navigation phones stay full-bleed.",bestFor:"Converted websites, dashboards, any UI with a fixed top bar.",drawsBehindBars:!0,injectsSpacer:!0,tintsStatusBar:!1},{id:"status-bar-tint",label:"Tinted status bar",tagline:"Keep the bars, match their colour",description:"Leaves the system bars in place (no draw-behind) and instead paints the status bar and navigation bar with your app's background colour. NativeBridge generates values/colors.xml and values-night/colors.xml plus the matching styles so the bars flip automatically when the device switches to dark mode.",bestFor:"Apps that want a classic, opaque chrome that still matches the theme.",drawsBehindBars:!1,injectsSpacer:!1,tintsStatusBar:!0},{id:"native-ready",label:"Already edge-to-edge",tagline:"The app handles its own insets",description:"For layouts already built for edge-to-edge. NativeBridge only does the native minimum: transparent bars, draw-behind, viewport-fit=cover and the safe-area CSS variables. No spacer and no padding is injected, so your existing insets keep working untouched.",bestFor:"Apps already using env(safe-area-inset-*) or a native design system.",drawsBehindBars:!0,injectsSpacer:!1,tintsStatusBar:!1}];function Bt(e){return Ft.find(t=>t.id===e)??Ft.find(t=>t.id===co)}const ti=e=>new Promise((t,s)=>{const o=new FileReader;o.onload=()=>t(o.result),o.onerror=s,o.readAsDataURL(e)}),Ut=e=>new Promise(t=>e.toBlob(async s=>t(await ti(s))));async function Lt(e){var S;const t={iconDataUrl:null,iconForegroundDataUrl:null,iconBackgroundColor:null,splashDataUrl:null,appearanceJson:null,row:null};if(!e)return t;let s=null;try{s=await Oi(e)}catch{return t}if(!s)return t;let o=null;if(s.icon_foreground_path)try{const u=await Mi(s.icon_foreground_path);if(u){const y=await(await fetch(u)).blob();o=await ti(y)}}catch{}const a={iconForegroundUrl:o,iconBackgroundColor:s.icon_background_color,iconPaddingPct:Number(s.icon_padding_pct),iconCornerRadiusPct:Number(s.icon_corner_radius_pct),iconLetterFallback:s.icon_letter_fallback,splashBgColor:s.splash_bg_color},r=await It(a,"launcher",1024),l=await It(a,"splash",1024),b=await Ut(r),g=await Ut(l);let P=Bt().id;try{const x=(S=(await Fi(e)).find(y=>y.plugin_id==="edge-to-edge"&&y.secret_key==="EDGE_TO_EDGE_MODE"))==null?void 0:S.secret_value;P=Bt(x).id}catch{}const N=(s.icon_background_color||"").trim(),c=/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(N)?N:"#FFFFFF",p=JSON.stringify({statusBar:{visible:s.status_bar_visible,color:s.status_bar_color,colorDark:s.status_bar_color_dark,style:s.status_bar_style},splash:{bg:s.splash_bg_color,bgDark:s.splash_bg_color_dark,durationMs:s.splash_duration_ms,resizeMode:s.splash_resize_mode},icon:{bg:c,paddingPct:Number(s.icon_padding_pct),cornerRadiusPct:Number(s.icon_corner_radius_pct)},edgeToEdge:{enabled:s.edge_to_edge_enabled,mode:P,navColor:s.edge_to_edge_nav_color},defaultTheme:s.default_theme},null,2);return{iconDataUrl:b,iconForegroundDataUrl:o,iconBackgroundColor:c,splashDataUrl:g,appearanceJson:p,row:s}}async function po(e){try{await J.from("appearance_configs").update({staged:!1}).eq("project_id",e)}catch{}}const uo=[{id:"scan",label:"Scanning project"},{id:"generate",label:"Generating native shell"},{id:"inject",label:"Injecting plugins & permissions"},{id:"assets",label:"Bundling web assets"},{id:"package",label:"Packaging ZIP"},{id:"done",label:"Build complete"}],mo=[{id:"scan",label:"Scanning project"},{id:"generate",label:"Preparing build package"},{id:"inject",label:"Configuring plugins"},{id:"assets",label:"Bundling source code"},{id:"package",label:"Packaging for cloud"},{id:"upload",label:"Uploading to cloud builder"},{id:"compile",label:"Building with Capacitor + Gradle"},{id:"sign",label:"Signing APK"},{id:"done",label:"APK Ready!"}],go=[{id:"analyze",label:"Analyzing project"},{id:"generate",label:"Generating Electron shell"},{id:"assets",label:"Bundling source code"},{id:"package",label:"Packaging for cloud"},{id:"upload",label:"Uploading to cloud builder"},{id:"compile",label:"Building with Electron Builder"},{id:"done",label:"Desktop builds ready!"}],fo=(e,t,s,o)=>e==="electron"?"electron":s?"github-repo":e==="webview"||e==="twa"||o&&!t?"prebuilt-project":(e==="capacitor"||e==="ionic")&&t?"capacitor-source":"prebuilt-project",ho=({isBuilding:e,onBuildComplete:t,engine:s="webview",enabledPlugins:o=[],appName:a="MyApp",packageName:r="com.mobileforge.app",url:l,outputMode:b="project",jobId:g,desktopPlatforms:P=["windows","macos","linux"],signingMode:N="debug",keystorePassword:c,keyAlias:p,keyPassword:S,keystoreBase64:u,iconDataUrl:x,projectId:y})=>{const I=s==="electron",w=I?go:b==="apk"?mo:uo,[v,H]=m.useState(-1),[Q,ce]=m.useState([]),[A,j]=m.useState(!1),[f,D]=m.useState(null),[h,U]=m.useState(null),[de,me]=m.useState(null),oe=m.useRef(null),[pe,ve]=m.useState([]),[Fe,Be]=m.useState(""),[Ue,ne]=m.useState(""),[Ye,ue]=m.useState(!1),[Je,We]=m.useState([]),[Ke,Ee]=m.useState(null),[Qe,De]=m.useState(null),{files:Ge,repoUrl:M,repoBranch:Ie,repoConnected:X}=Pe(),Se=Ki({orchestrator:Ke,buildPlan:Qe});m.useEffect(()=>{he.getState().setActivePhaseGroups(Se.phaseGroups)},[Se.phaseGroups]),m.useEffect(()=>{he.getState().setActiveCiSteps(Je)},[Je]),m.useEffect(()=>{he.getState().setIsBuildActive(!!e),e||he.getState().clearBuildProgress()},[e]);const d=m.useCallback(_=>{ce(ae=>[...ae,_]),g&&he.getState().appendLog(g,_)},[g]),ge=m.useCallback((_,ae)=>{var xe;if(H(_),g){const R=ae||(_<w.length?(xe=w[_])==null?void 0:xe.label:"Complete");he.getState().updateJob(g,{stage:R})}},[g,w]),K=m.useCallback((_,ae)=>{g&&he.getState().updateJob(g,{status:_,...ae})},[g]),ee=m.useCallback((_,ae="pending",xe)=>{const R=crypto.randomUUID();return ve(Me=>[...Me,{id:R,title:_,status:ae,startedAt:ae==="active"?Date.now():void 0,finding:xe}]),R},[]),ke=m.useCallback((_,ae)=>{ve(xe=>xe.map(R=>R.id===_?{...R,...ae}:R))},[]),fe=m.useCallback(_=>{Be(ae=>ae+_)},[]),te=m.useCallback(async _=>{if(g)try{const{data:{session:ae}}=await J.auth.getSession();if(!ae)return;const R=he.getState().getJob(g);if(!R)return;const{data:Me}=await J.from("builds").select("id").eq("id",g).maybeSingle();Me?await J.from("builds").update({status:R.status,stage:R.stage,logs:R.logs,error:R.error||null,repo_name:R.repoName||null,repo_url:R.repoUrl||null,completed_at:_.completedAt?new Date(_.completedAt).toISOString():null,..._}).eq("id",g):await J.from("builds").insert({id:g,user_id:ae.user.id,app_name:R.appName,package_name:R.packageName,engine:R.engine,status:R.status,stage:R.stage,logs:R.logs,repo_name:R.repoName||null,repo_url:R.repoUrl||null,error:R.error||null,project_id:y||null})}catch(ae){console.error("Failed to persist build:",ae)}},[g]);m.useEffect(()=>{if(!e)return;ge(0),ce([]),ve([]),Be(""),ue(!0),j(!1),D(null),U(null),me(null),Ee(null),De(null),Se.reset(),K("building"),te({}),(async()=>{var ae,xe;try{const R=Ge.length>0,Me=X&&M.length>0,ze=!!(l&&l.startsWith("http")),Ce=fo(s,R,Me,ze);fe(`## 🔧 Build Configuration

- **Engine:** ${s}
- **App:** ${a} (\`${r}\`)
- **Mode:** ${Ce}

`);const Te=ee("Configuring build environment","active");if(d("> Detecting engine: "+s),d("> App: "+a+" ("+r+")"),d("> Build mode: "+Ce),await se(400),ke(Te,{status:"done",elapsed:.4,finding:`→ ${s} engine, ${Ce} mode`}),R){const V=hi(Pe.getState().files,a);if(V.patches.length>0){d("> Grounding project before build...");for(const F of V.patches)Pe.getState().updateFileContent(F.path,F.content),d(`> ✓ ${F.path}: ${F.reason}`)}for(const F of V.logs)d("> "+F)}if(Ce==="electron")d("> Mode: Electron Desktop Build"),d("> Target platforms: "+P.join(", ")),l&&d("> Target URL: "+l);else if(Ce==="github-repo")d("> Mode: GitHub Repository → Clone & Build in cloud"),d("> Repository: "+M),d("> Branch: "+Ie);else if(Ce==="capacitor-source"){d("> Mode: Source Code Upload → Capacitor CLI in cloud");const V=Ve(Ge);d("> Files detected: "+V.filter(F=>F.type==="file").length)}else l?(d("> Mode: URL-to-App (pre-generated Android project)"),d("> Target URL: "+l)):d("> Mode: Pre-built Android project");if(await se(600),ge(1),Ce==="electron"){d("> Running pre-build analysis...");try{const q=Ve(Pe.getState().files),re=q.filter(W=>W.type==="file").map(W=>W.path);let we;const O=q.find(W=>W.path==="package.json"||W.path.endsWith("/package.json"));if(O!=null&&O.content)try{we=JSON.parse(O.content)}catch{}const{data:G}=await J.functions.invoke("analyze-project",{body:{fileList:re,packageJson:we,engine:"electron",platform:"desktop",url:l||void 0,hasSourceFiles:q.length>0}});if(G&&!G.error){d("> ✓ Analysis complete — Score: "+G.score+"/100"),d("> Strategy: "+G.buildStrategy),G.projectShape&&d("> Shape: "+G.projectShape.shape+(G.projectShape.expectedWebDir?" (webDir="+G.projectShape.expectedWebDir+")":"")+(G.projectShape.isMonorepo?" [monorepo]":""));for(const W of G.checks||[]){const L=W.status==="pass"?"✓":W.status==="warn"?"⚠":"✗";d(">   "+L+" "+W.label+": "+W.detail)}if(((ae=G.recommendations)==null?void 0:ae.length)>0){d("> Recommendations:");for(const W of G.recommendations)d(">   → "+W)}G.compatible||d("> ⚠ Project may have compatibility issues (score: "+G.score+")")}}catch{d("> ⚠ Analysis skipped (service unavailable)")}await se(400),ge(1),d("> Generating Electron project...");const V=Bs({appName:a,packageName:r,url:l||void 0,platforms:P});for(const q of V)d("> + "+q.path);await se(400),ge(2),d("> Bundling source code...");const F=new st;let z=0;const qe=Ve(Pe.getState().files);for(const q of qe)q.type==="file"&&(q.isBinary&&q.binaryContent?F.file(q.path,q.binaryContent):q.content&&F.file(q.path,q.content),z++);z>0?d("> ✓ Bundled "+z+" source files"):d("> URL-only desktop build — no source ZIP needed"),await se(300),ge(3);const Re=await F.generateAsync({type:"blob"});D(Re),d("> ZIP size: "+(Re.size/1024).toFixed(1)+" KB"),ge(4),K==null||K("uploading"),d("> Uploading to cloud builder...");try{let q;if(z>0){const O=await Re.arrayBuffer(),G=new Uint8Array(O);let W="";const L=8192;for(let ie=0;ie<G.byteLength;ie+=L){const n=G.subarray(ie,ie+L);W+=String.fromCharCode(...n)}q=btoa(W)}const{data:re,error:we}=await J.functions.invoke("build-desktop",{body:{action:"start",projectZip:q,projectName:a,appName:a,packageName:r,platforms:P,url:l||void 0}});if(we)throw we;if(re!=null&&re.error)d("> ✗ "+re.error),me(re.error),K==null||K("failure",{error:re.error});else{const O=re.repoName;g&&he.getState().updateJob(g,{repoName:O,repoUrl:`https://github.com/${re.username}/${O}`}),d("> ✓ Build submitted! Repo: "+O),ge(5),K==null||K("building"),te==null||te({}),d("> Building desktop apps (this may take 5-10 minutes)...");let G=re.runId,W=!1,L=0;const ie=60;for(;!W&&L<ie;){await se(L<5?5e3:1e4),L++;const{data:n}=await J.functions.invoke("build-desktop",{body:{action:"status",repoName:O,runId:G}});if(n!=null&&n.runId&&!G&&(G=n.runId),n!=null&&n.logs)for(const T of n.logs)d("> "+T);if(L%5===0&&(te==null||te({})),(n==null?void 0:n.status)==="success"){d("> ✓ Desktop builds complete!"),W=!0,d("> Downloading artifacts...");try{const{data:T}=await J.functions.invoke("build-desktop",{body:{action:"download",repoName:O,runId:G}});if(T!=null&&T.artifactBase64){const B=atob(T.artifactBase64),Y=new Uint8Array(B.length);for(let Ae=0;Ae<B.length;Ae++)Y[Ae]=B.charCodeAt(Ae);const be=new Blob([Y],{type:"application/zip"});D(be),d("> ✓ Artifacts downloaded ("+(be.size/(1024*1024)).toFixed(1)+" MB)")}}catch{d("> ⚠ Could not download artifacts automatically")}try{await J.functions.invoke("build-desktop",{body:{action:"delete-repo",repoName:O}}),d("> ✓ Build repository cleaned up")}catch{}K==null||K("success",{completedAt:Date.now()}),te==null||te({completedAt:Date.now()})}else if((n==null?void 0:n.status)==="failure"){if(d("> ✗ Desktop build failed."),n!=null&&n.buildLogs){d("> ── Build Error Output ──");for(const T of n.buildLogs.split(`
`).slice(-40))d(">   "+T);d("> ── End of Logs ──")}me("Desktop build failed. Check logs above."),K==null||K("failure",{error:"Build failed",completedAt:Date.now()}),te==null||te({completedAt:Date.now()}),W=!0}else L%3===0&&d("> ... building ("+L+"/"+ie+")")}W||(d("> ⚠ Build timed out."),me("Build timed out."),K==null||K("timeout",{completedAt:Date.now()}),te==null||te({completedAt:Date.now()}))}}catch(q){d("> ⚠ Cloud build error: "+((q==null?void 0:q.message)||"Unknown")),me((q==null?void 0:q.message)||"Build failed"),K==null||K("failure",{error:q==null?void 0:q.message,completedAt:Date.now()}),te==null||te({completedAt:Date.now()})}}else if(Ce==="github-repo"){d("> Submitting GitHub repo build to cloud...");const V=bi(o);if(V.length>0){d("> Plugins to install:");for(const F of V)d(">   • "+F)}ge(2),await se(300),ge(3),d("> No local bundling needed — cloud will clone directly"),await se(300),ge(4),b==="apk"?await bo(d,F=>ge(F),U,D,me,a,r,V,M,Ie,g,K,te,We):(d("> ⚠ Project ZIP mode not supported for GitHub repo builds."),me("GitHub repo builds only support APK output mode."),K("failure",{error:"GitHub repo builds only support APK output mode."}))}else if(Ce==="capacitor-source"){const V=new lo;Ee(V),V.on(k=>{d(`> [${k.status}] ${k.label}${k.detail?` — ${k.detail}`:""}${k.elapsed?` (${k.elapsed.toFixed(1)}s)`:""}`)});let F=null;try{F=await ro(y||"",Pe.getState().files,o,s),De(F),F.isIncremental&&(fe(`### ⚡ Incremental Build

Skipping ${F.skippedPhases.length} unchanged phase(s): ${F.skippedPhases.join(", ")}

`),d(`> ⚡ Incremental build — skipping: ${F.skippedPhases.join(", ")}`))}catch{d("> ⚠ Orchestrator unavailable, running full build")}const z=k=>(F==null?void 0:F.skippedPhases.includes(k))??!1;fe(`### 🔍 Pre-Build Validation

`);const qe=ee("Validating project","active"),Re=Ve(Pe.getState().files),q=Re.map(k=>({path:k.path,type:k.type,content:k.content,size:k.size,isBinary:k.isBinary,binaryContent:k.binaryContent})),re=Hs(q),we=xi(Re,re),O=wi(we);if(await se(300),!we.canBuild){fe(`❌ **Validation Failed**

${we.errors.map(k=>`- ${k}`).join(`
`)}

Please fix these issues and try again.

`),ke(qe,{status:"error",elapsed:.3,finding:O.join(`
`)});for(const k of we.errors)ee(k,"error");me("Project failed pre-build validation. Fix the issues above."),K("failure",{error:"Pre-build validation failed",completedAt:Date.now()}),te({completedAt:Date.now()}),j(!0),ue(!1);return}if(fe(`✅ All pre-build checks passed
${we.warnings.length>0?we.warnings.map(k=>`- ⚠️ ${k}`).join(`
`)+`
`:""}
`),ke(qe,{status:"done",elapsed:.3,finding:we.warnings.length>0?O.join(`
`):"→ All checks passed"}),z("scan"))V.skipPhase("scan","Source unchanged"),ee("Scanning project structure — skipped","done");else{V.startPhase("scan"),fe(`### 📂 Project Analysis

`);const k=ee("Scanning project structure","active");for(const $ of Js(re))d("> "+$);await se(300),fe(`- **Framework:** ${re.framework}
- **Source files:** ${re.sourceFiles}

`),ke(k,{status:"done",elapsed:.3,finding:`→ ${re.framework}, ${re.sourceFiles} files`}),V.completePhase("scan")}if(z("compatibility"))V.skipPhase("compatibility","Already verified"),ee("Checking compatibility — skipped","done");else{V.startPhase("compatibility");const k=ee("Checking compatibility","active"),$=Ks(re,s,b);for(const Z of qs($))d("> "+Z);await se(200),fe($.compatible?`✅ Project is compatible with the selected engine

`:`⚠️ Compatibility issues: ${$.blockers.join(", ")}

`),ke(k,{status:$.compatible?"done":"error",elapsed:.2,finding:$.compatible?"→ Compatible":`→ ${$.blockers.join(", ")}`}),V.completePhase("compatibility")}if(z("dependencies"))V.skipPhase("dependencies","Dependencies unchanged"),ee("Resolving dependencies — skipped","done");else{V.startPhase("dependencies");const k=ee("Resolving dependencies","active"),$=Zs(re);for(const Z of Xs($))d("> "+Z);await se(200),fe(`- **Install command:** \`${$.installCommand}\`

`),ke(k,{status:"done",elapsed:.2,finding:`→ ${$.installCommand}`}),V.completePhase("dependencies")}const G=ee("Generating build config","active"),W=io();for(const k of so(W))d("> "+k);await se(200),ke(G,{status:"done",elapsed:.2,finding:`→ AGP ${W.agpVersion}, Gradle ${W.gradleVersion}`});try{const k=Re.filter(E=>E.type==="file").map(E=>E.path);let $;const Z=Re.find(E=>E.path==="package.json"||E.path.endsWith("/package.json"));if(Z!=null&&Z.content)try{$=JSON.parse(Z.content)}catch{}const{data:C}=await J.functions.invoke("analyze-project",{body:{fileList:k,packageJson:$,engine:s,platform:"android",url:l||void 0,hasSourceFiles:!0}});C&&!C.error&&(d("> ✓ AI Analysis — Score: "+C.score+"/100 | Strategy: "+C.buildStrategy),C.projectShape&&d(">   Shape: "+C.projectShape.shape+(C.projectShape.isMonorepo?" [monorepo]":"")+(C.projectShape.routerMode!=="none"?" router="+C.projectShape.routerMode:"")))}catch{d("> ⚠ AI analysis skipped")}const L=ee("Generating app icons","active");let ie=[];try{ie=x?await Dt(x):await Rt(a),ke(L,{status:"done",elapsed:.3,finding:`→ ${ie.length} density buckets`})}catch{ke(L,{status:"done",elapsed:.1,finding:"→ Skipped (canvas not available)"})}await se(300),ge(2);let n=[];if(z("plugins"))V.skipPhase("plugins","Plugins unchanged"),ee("Configuring plugins — skipped","done"),n=vt(o,s).npmPackages;else{V.startPhase("plugins");const k=ee("Configuring plugins","active"),$=vt(o,s);n=$.npmPackages;for(const C of Ot($))d("> "+C);if(await se(200),ke(k,{status:"done",elapsed:.2,finding:n.length>0?`→ ${n.length} plugin(s)`:"→ No plugins"}),V.completePhase("plugins"),o.length>0){const C=Re.filter(le=>le.type==="file"&&le.content&&!le.isBinary).map(le=>le.content||""),E=yi(o,C);if(E.length>0){ee("Plugin usage check","done");for(const le of E)d(`> ⚠ Plugin "${le.pluginId}" (${le.npm}) is enabled but no usage found in source code`);fe(`⚠️ **Plugins enabled but not used in code:**
${E.map(le=>`- ${le.npm}`).join(`
`)}

These will still be installed but may not be needed.

`)}}const Z=vi(o);if(Z.length>0){for(const C of Z)C.secretsDescription&&d(`> ⚠ ${C.npm}: ${C.secretsDescription}`),C.manualConfigDescription&&d(`> ⚠ ${C.npm}: ${C.manualConfigDescription}`);fe(`### ⚠️ Plugin Configuration Required

${Z.map(C=>`- **${C.npm}**: ${C.secretsDescription||C.manualConfigDescription||"Needs configuration"}`).join(`
`)}

`)}}if(!z("ai-inject")&&n.length>0){V.startPhase("ai-inject");const k=ee("AI code integration","active");fe(`### 🧠 AI Code Integration

`);try{const $=Ve(Pe.getState().files).filter(C=>C.type==="file"&&C.content).map(C=>({path:C.path,content:C.content})),Z=Qs($,o,s);if(Z.injections.length>0){for(const le of to(Z))d("> "+le);const E=eo(Z,(le,je)=>{Pe.getState().updateFileContent(le,je)});if(E.length>0){fe(`- Injected plugin code into: ${E.join(", ")}
`),d(`> ✓ Applied code injections to ${E.length} file(s)`);for(const le of E){const je=Ve(Pe.getState().files).find(ye=>ye.path===le);if(je!=null&&je.content){const ye=ao(je.content);if(!ye.valid)for(const Xe of ye.issues)d(`> ⚠ Validation issue in ${le}: ${Xe}`)}}}fe(`- ${Z.injections.length} plugin(s) configured

`)}ke(k,{status:"done",elapsed:.5,finding:`→ ${Z.injections.length} plugin(s) injected`}),V.completePhase("ai-inject")}catch($){d(`> ⚠ AI injection error (non-blocking): ${$==null?void 0:$.message}`),ke(k,{status:"done",elapsed:.3,finding:"→ Skipped (error)"}),V.errorPhase("ai-inject",($==null?void 0:$.message)||"Unknown")}}else z("ai-inject")&&(V.skipPhase("ai-inject","No injection needed"),ee("AI code integration — skipped","done"));await se(300),ge(3),V.startPhase("bundle");const T=ee("Bundling source code","active"),B=Ve(Pe.getState().files);if(n.length>0){const k=B.findIndex($=>$.path==="package.json"||$.path.endsWith("/package.json"));if(k!==-1&&B[k].content)try{const $=JSON.parse(B[k].content);$.dependencies=$.dependencies||{};let Z=0;for(const C of n)!$.dependencies[C]&&!($.devDependencies&&$.devDependencies[C])&&($.dependencies[C]="latest",Z++);if(Z>0){const C=JSON.stringify($,null,2);B[k]={...B[k],content:C},Pe.getState().updateFileContent(B[k].path,C),d(`> ✓ Added ${Z} plugin(s) to package.json dependencies`)}}catch($){d(`> ⚠ Could not patch package.json: ${$.message}`)}}const Y=new st;let be=0;for(const k of B)k.type==="file"&&(k.isBinary&&k.binaryContent?Y.file(k.path,k.binaryContent):k.content&&!k.isBinary&&Y.file(k.path,k.content),be++);const Ae={appName:a,packageName:r,engine:s,plugins:n,buildMode:"capacitor-source",buildHash:F==null?void 0:F.currentHash};if(Y.file("nativebridge-config.json",JSON.stringify(Ae,null,2)),ie.length>0){const k=new st;for(const Z of ie)k.file(`${Z.folder}/ic_launcher.png`,Z.squareBlob),k.file(`${Z.folder}/ic_launcher_round.png`,Z.roundBlob);const $=await k.generateAsync({type:"arraybuffer"});Y.file("icons.zip",$)}await se(400),ge(4),V.completePhase("bundle");const Ze=await Y.generateAsync({type:"blob"});if(D(Ze),fe(`### 📦 Bundling

- **Files bundled:** ${be}
- **Package size:** ${(Ze.size/1024).toFixed(0)} KB
${F!=null&&F.isIncremental?`- **Mode:** Incremental (${F.skippedPhases.length} phases skipped)
`:""}
`),ke(T,{status:"done",elapsed:.8,finding:`→ ${be} files, ${(Ze.size/1024).toFixed(0)} KB`}),y&&Pe.getState().files.length>0)try{await ki(y,Pe.getState().files,o,{engine:s,appName:a,packageName:r}),d("> ✓ Source code persisted to cloud storage")}catch{d("> ⚠ Source persistence skipped")}if(b==="apk"){V.startPhase("upload"),fe(`### ☁️ Cloud Build

Uploading to cloud builder and creating Ubuntu virtual machine with **JDK 21** and **Android SDK 34**...

`);const k=ee("Uploading to cloud builder","active");K("uploading");const $=g?he.getState().jobs.find(je=>je.id!==g&&je.status==="success"&&je.sourceRepoName):null,Z=F!=null&&F.isIncremental?$==null?void 0:$.sourceRepoName:void 0;let C=[];if(y&&o.length>0)try{const{fileSecrets:je}=await Bi(y);for(const ye of je){const{data:Xe}=await J.storage.from("build-artifacts").download(ye.storagePath);if(Xe){const ft=await Xe.arrayBuffer(),$e=new Uint8Array(ft);let et="";for(let tt=0;tt<$e.byteLength;tt+=8192){const St=$e.subarray(tt,tt+8192);et+=String.fromCharCode(...St)}const ot=btoa(et),Oe=ye.key==="google-services.json"?"google-services.json":ye.key;C.push({path:Oe,contentBase64:ot}),d(`> ✓ Plugin config: ${ye.key}`)}}}catch{d("> ⚠ Plugin config fetch skipped")}const E=await Lt(y),le=E.iconDataUrl||x;E.row&&d("> ✓ Applied staged appearance config"),await Vt(Ze,d,je=>ge(je),U,D,me,a,r,n,Ce,g,K,te,ee,ke,fe,ne,N,c,p,S,u,Z,We,le,C,E.splashDataUrl,E.appearanceJson,y,E.iconForegroundDataUrl,E.iconBackgroundColor)}}else{d("> Running pre-build analysis...");try{const O=Ve(Ge),G=O.filter(n=>n.type==="file").map(n=>n.path);let W;const L=O.find(n=>n.path==="package.json"||n.path.endsWith("/package.json"));if(L!=null&&L.content)try{W=JSON.parse(L.content)}catch{}const{data:ie}=await J.functions.invoke("analyze-project",{body:{fileList:G,packageJson:W,engine:s,platform:"android",url:l||void 0,hasSourceFiles:O.length>0}});if(ie&&!ie.error){d("> ✓ Analysis — Score: "+ie.score+"/100 | Strategy: "+ie.buildStrategy),ie.projectShape&&d(">   Shape: "+ie.projectShape.shape+(ie.projectShape.isMonorepo?" [monorepo]":"")+(ie.projectShape.expectedWebDir?" webDir="+ie.projectShape.expectedWebDir:""));for(const n of ie.checks||[]){const T=n.status==="pass"?"✓":n.status==="warn"?"⚠":"✗";d(">   "+T+" "+n.label+": "+n.detail)}if(((xe=ie.recommendations)==null?void 0:xe.length)>0)for(const n of ie.recommendations)d(">   → "+n)}}catch{d("> ⚠ Analysis skipped")}d("> Generating "+wo(s)+" Android project...");let V;try{d("> Generating default app icons..."),V=x?await Dt(x):await Rt(a),d("> ✓ Generated icons for "+V.length+" density buckets")}catch{d("> ⚠ Icon generation skipped (canvas not available)")}const F={appName:a,packageName:r,url:l||void 0,icons:V};let z;switch(s){case"capacitor":z=Yt(F);break;case"ionic":z=js(F);break;case"twa":z=Ts(F);break;default:z=fs(F)}for(const O of z)d("> + "+O.path);await se(800),ge(2);const qe=vt(o,s),Re=qe.npmPackages;for(const O of Ot(qe))d("> "+O);if(o.length>0&&(s==="capacitor"||s==="ionic")){d("> Injecting "+o.length+" plugin(s)...");const O=z.findIndex(L=>L.path.includes("AndroidManifest.xml"));O!==-1&&(z[O]={...z[O],content:Vs(z[O].content,o)},d("> Injected permissions into AndroidManifest.xml"));const G=z.findIndex(L=>L.path==="app/build.gradle");G!==-1&&(z[G]={...z[G],content:Ws(z[G].content,o)},d("> Injected dependencies into build.gradle"));const W=z.findIndex(L=>L.path.includes("MainActivity.java"));W!==-1&&(z[W]={...z[W],content:Gs(z[W].content,o)},d("> Injected plugin registrations into MainActivity.java"))}else d("> No plugins to inject");if(await se(500),ge(3),Ge.length>0){const O=Ve(Ge),G=O.filter(L=>L.type==="file"&&L.content&&!L.isBinary),W=O.filter(L=>L.type==="file"&&L.isBinary&&L.binaryContent);d("> Packaging "+(G.length+W.length)+" source files...");for(const L of G)z.push({path:"web-source/"+L.path,content:L.content||""});for(const L of W)z.push({path:"web-source/"+L.path,content:L.binaryContent,isBinary:!0});d("> ✓ Source files packaged")}else d("> URL mode — no assets to bundle");await se(400),ge(4),d("> Creating ZIP archive..."),z.push({path:".github/workflows/build.yml",content:xo()}),d("> + .github/workflows/build.yml");const re=new st;for(const O of z)O.isBinary&&O.content instanceof ArrayBuffer,re.file(O.path,O.content);const we=await re.generateAsync({type:"blob"});if(D(we),d("> ZIP size: "+(we.size/1024).toFixed(1)+" KB"),d("> Total files: "+z.length),b==="apk"){K("uploading");const O=await Lt(y),G=O.iconDataUrl||x;await Vt(we,d,W=>ge(W),U,D,me,a,r,Re,Ce,g,K,te,void 0,void 0,fe,ne,N,c,p,S,u,void 0,We,G,void 0,O.splashDataUrl,O.appearanceJson,y,O.iconForegroundDataUrl,O.iconBackgroundColor)}}d("> ✓ Build pipeline complete!"),await se(300),ge(w.length,"Complete"),j(!0),ue(!1);const Ne=g?he.getState().getJob(g):null;(Ne==null?void 0:Ne.status)==="failure"||(Ne==null?void 0:Ne.status)==="timeout"||(K("success",{completedAt:Date.now()}),te({completedAt:Date.now()})),t==null||t()}catch(R){d("> ✗ Build failed: "+((R==null?void 0:R.message)||"Unknown error")),fe(`
### ❌ Build Failed

${(R==null?void 0:R.message)||"Unknown error"}
`),me((R==null?void 0:R.message)||"Build failed"),K("failure",{error:(R==null?void 0:R.message)||"Build failed",completedAt:Date.now()}),te({completedAt:Date.now()}),j(!0),ue(!1)}})()},[e]),m.useEffect(()=>{oe.current&&(oe.current.scrollTop=oe.current.scrollHeight)},[Q]);const mt=()=>{if(!h)return;const _=document.createElement("a");_.href=URL.createObjectURL(h),_.download=`${a.replace(/\s+/g,"_")}.apk`,document.body.appendChild(_),_.click(),document.body.removeChild(_),URL.revokeObjectURL(_.href)},gt=()=>{if(!f)return;const _=document.createElement("a");_.href=URL.createObjectURL(f),_.download=`${a.replace(/\s+/g,"_")}_${I?"desktop":"android"}_project.zip`,document.body.appendChild(_),_.click(),document.body.removeChild(_),URL.revokeObjectURL(_.href)};return!e&&!A?null:i.jsxs("div",{className:"space-y-4",children:[Fe||Ue?i.jsx(Hi,{content:Fe+Ue,isStreaming:Ye,label:"ForgeAI Build"}):null,Se.actions.length>0&&i.jsxs("div",{className:"rounded-xl bg-card border border-border overflow-hidden",children:[i.jsx("div",{className:"px-3 pt-2.5 pb-1",children:i.jsx("div",{className:"text-[10px] font-medium text-muted-foreground uppercase tracking-wider",children:"Build Pipeline"})}),i.jsx(qt,{actions:Se.actions,estimatedTimeRemaining:Se.estimatedTimeRemaining,progressPercent:Se.progressPercent,elapsedSeconds:Se.elapsedSeconds,className:"max-h-[300px]"})]}),Je.length>0?i.jsxs("div",{className:"space-y-0.5 rounded-xl bg-card border border-border p-3",children:[i.jsx("div",{className:"text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2",children:"GitHub Actions Steps"}),Je.map((_,ae)=>{const xe=_.status==="completed"&&_.conclusion==="success",R=_.status==="completed"&&_.conclusion==="failure",Me=_.status==="in_progress";_.status;let ze="";if(_.startedAt){const Ce=new Date(_.startedAt).getTime(),Te=_.completedAt?new Date(_.completedAt).getTime():Date.now(),Ne=Math.round((Te-Ce)/1e3);Ne>=60?ze=`${Math.floor(Ne/60)}m ${Ne%60}s`:Ne>0&&(ze=`${Ne}s`)}return i.jsxs("div",{className:"flex items-center gap-2 py-0.5",children:[xe?i.jsx(rt,{size:13,className:"text-[hsl(var(--success))] shrink-0"}):R?i.jsx(wt,{size:13,className:"text-destructive shrink-0"}):Me?i.jsx(kt,{size:13,className:"animate-spin text-primary shrink-0"}):i.jsx(wt,{size:13,className:"text-muted-foreground/30 shrink-0"}),i.jsx("span",{className:`text-xs truncate ${xe?"text-muted-foreground":R?"text-destructive font-medium":Me?"shimmer-text font-semibold":"text-muted-foreground/40"}`,children:_.name}),ze&&(_.status==="completed"||Me)&&i.jsxs("span",{className:"ml-auto flex items-center gap-0.5 text-[10px] text-muted-foreground/60 shrink-0 tabular-nums",children:[i.jsx(Ht,{size:9}),ze]})]},`${_.number}-${_.name}`)})]}):!Fe&&!Ue?i.jsx("div",{className:"space-y-1",children:w.map((_,ae)=>{const xe=ae<v,R=ae===v&&!A;return i.jsxs("div",{className:"flex items-center gap-2 py-1",children:[xe||A&&ae===w.length-1?i.jsx(rt,{size:14,className:"text-[hsl(var(--success))]"}):R?i.jsx(kt,{size:14,className:"animate-spin text-foreground"}):i.jsx(wt,{size:14,className:"text-muted-foreground/40"}),i.jsx("span",{className:`text-xs ${xe||A?"text-[hsl(var(--success))]":R?"shimmer-text font-medium":"text-muted-foreground/50"}`,children:_.label})]},_.id)})}):null,de&&i.jsx("div",{className:"px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/30 text-xs text-destructive",children:de}),A&&i.jsxs("div",{className:"space-y-2",children:[h&&i.jsxs(He,{className:"w-full gap-2 h-11",onClick:mt,children:[i.jsx(gi,{size:16})," Download APK (",(h.size/(1024*1024)).toFixed(1)," MB)"]}),f&&i.jsxs(He,{variant:h?"outline":"default",className:"w-full gap-2",size:"sm",onClick:gt,children:[i.jsx(fi,{size:14})," ",I?"Download Desktop Build (.zip)":"Download Android Studio Project (.zip)"]})]})]})};async function bo(e,t,s,o,a,r,l,b,g,P,N,c,p,S){await se(300),t(5),e("> Submitting build request to cloud..."),c==null||c("uploading");try{const{data:u,error:x}=await J.functions.invoke("build-apk",{body:{action:"start",projectName:r,buildMode:"github-repo",appName:r,packageName:l,plugins:b,sourceRepoUrl:g,sourceBranch:P}});if(x)throw x;if(u!=null&&u.error){e("> ✗ "+u.error),a(u.error),c==null||c("failure",{error:u.error});return}const y=u.repoName,I=u.commitSha,w=u.username?`${u.username}/${y}`:y;N&&he.getState().updateJob(N,{repoName:y,repoUrl:`https://github.com/${w}`,commitSha:I}),e("> ✓ Build submitted! Repo: "+y),t(6),c==null||c("building"),p==null||p({}),e("> Cloning repo & building (this may take 5-8 minutes)...");let v=u.runId,H=!1,Q=0;const ce=60;for(;!H&&Q<ce;){await se(Q<5?5e3:1e4),Q++;const{data:A}=await J.functions.invoke("build-apk",{body:{action:"status",repoName:y,runId:v,commitSha:I}});if(A!=null&&A.runId&&!v&&(v=A.runId),A!=null&&A.allSteps&&S&&S(A.allSteps),A!=null&&A.logs)for(const j of A.logs)e("> "+j);if(Q%5===0&&(p==null||p({})),(A==null?void 0:A.status)==="success")t(7),e("> ✓ Build successful!"),e("> Downloading APK..."),H=!0,await ii(e,s,o,a,y,v,N,c,p);else if((A==null?void 0:A.status)==="failure"){e("> ✗ Cloud build failed.");let j=A==null?void 0:A.buildLogs;if(!j&&y){e("> Fetching error details..."),await se(3e3);const{data:f}=await J.functions.invoke("build-apk",{body:{action:"status",repoName:y,runId:v}});if(j=f==null?void 0:f.buildLogs,f!=null&&f.logs)for(const D of f.logs)e("> "+D)}if(j){e("> ── Build Error Output ──");const f=j.split(`
`).filter(D=>D.trim());for(const D of f.slice(-60))e(">   "+D);e("> ── End of Logs ──")}else if(e("> No detailed error logs available."),e("> Check the GitHub Actions run directly for full output."),N){const f=he.getState().getJob(N);f!=null&&f.repoUrl&&e("> "+f.repoUrl+"/actions")}a("Build failed. Check the logs above."),c==null||c("failure",{error:"Build failed",completedAt:Date.now()}),p==null||p({completedAt:Date.now()}),H=!0}else(A==null?void 0:A.status)==="waiting"?Q%3===0&&e("> ... waiting for build to start"):Q%3===0&&e("> ... compiling ("+Q+"/"+ce+")")}H||(e("> ⚠ Build timed out after 10 minutes."),a("Build timed out."),c==null||c("timeout",{completedAt:Date.now()}),p==null||p({completedAt:Date.now()}))}catch(u){e("> ⚠ Cloud build error: "+((u==null?void 0:u.message)||"Unknown")),a((u==null?void 0:u.message)||"Build failed"),c==null||c("failure",{error:u==null?void 0:u.message,completedAt:Date.now()}),p==null||p({completedAt:Date.now()})}}async function Vt(e,t,s,o,a,r,l,b,g,P,N,c,p,S,u,x,y,I,w,v,H,Q,ce,A,j,f,D,h,U,de,me){var oe;await se(300),s(5),t("> Uploading project to cloud builder...");try{const pe=await e.arrayBuffer(),ve=new Uint8Array(pe);let Fe="";const Be=8192;for(let M=0;M<ve.byteLength;M+=Be){const Ie=ve.subarray(M,M+Be);Fe+=String.fromCharCode(...Ie)}const Ue=btoa(Fe),{data:ne,error:Ye}=await J.functions.invoke("build-apk",{body:{action:"start",projectZip:Ue,projectName:l,buildMode:P,appName:l,packageName:b,plugins:g,signingMode:I||"debug",keystorePassword:w,keyAlias:v,keyPassword:H,keystoreBase64:Q,iconDataUrl:j||void 0,iconForegroundDataUrl:de||void 0,iconBackgroundColor:me||void 0,splashDataUrl:D||void 0,appearanceJson:h||void 0,existingRepoName:ce||void 0,pluginConfigFiles:f!=null&&f.length?f:void 0}});if(Ye)throw Ye;if(ne!=null&&ne.error){t("> ✗ "+ne.error),r(ne.error),c==null||c("failure",{error:ne.error});return}const ue=ne.repoName,Je=ne.commitSha,We=ne.username?`${ne.username}/${ue}`:ue;N&&he.getState().updateJob(N,{repoName:ue,repoUrl:`https://github.com/${We}`,commitSha:Je,sourceRepoName:ue}),t("> ✓ Build submitted! Repo: "+ue+(ne.isReusing?" (incremental)":"")),U&&po(U),S&&u&&u("__upload__",{status:"done",finding:`→ Repo: ${ue}`}),s(6),c==null||c("building"),p==null||p({});const Ke=(S==null?void 0:S("Compiling with Gradle","active"))||"";t("> Compiling with Gradle (this may take 3-5 minutes)...");let Ee=ne.runId,Qe=!1,De=0;const Ge=60;for(;!Qe&&De<Ge;){await se(De<2?12e3:De<5?6e3:1e4),De++;const{data:M}=await J.functions.invoke("build-apk",{body:{action:"status",repoName:ue,runId:Ee,commitSha:Je}});if(M!=null&&M.runId&&!Ee&&(Ee=M.runId),M!=null&&M.runId&&Ee&&M.runId>Ee&&(Ee=M.runId),M!=null&&M.allSteps&&A&&A(M.allSteps),((oe=M==null?void 0:M.logs)==null?void 0:oe.length)>0){const Ie=M.logs.map(X=>X.startsWith("✓")?`- ✅ ${X.slice(2)}`:X.startsWith("✗")?`- ❌ ${X.slice(2)}`:X.startsWith("⟳")?`- ⏳ ${X.slice(2)} (running...)`:null).filter(Boolean);Ie.length>0&&y&&y(`### ☁️ Cloud Build Progress

${Ie.join(`
`)}

`);for(const X of M.logs)t("> "+X)}if(De%5===0&&(p==null||p({})),(M==null?void 0:M.status)==="success"){s(7),t("> ✓ Build successful!"),t("> Downloading APK..."),u&&Ke&&u(Ke,{status:"done",finding:"→ Build successful"});const Ie=(S==null?void 0:S("Downloading APK artifact","active"))||"";Qe=!0,await ii(t,o,a,r,ue,Ee,N,c,p)}else if((M==null?void 0:M.status)==="failure"){u&&Ke&&u(Ke,{status:"error",finding:"→ Build failed"}),t("> ✗ Cloud build failed."),M!=null&&M.errorInfo&&N&&he.getState().updateJob(N,{errorInfo:M.errorInfo});let Ie=M==null?void 0:M.buildLogs;if(!Ie&&ue){t("> Fetching error details..."),await se(3e3);const{data:X}=await J.functions.invoke("build-apk",{body:{action:"status",repoName:ue,runId:Ee}});if(Ie=X==null?void 0:X.buildLogs,X!=null&&X.logs)for(const Se of X.logs)t("> "+Se);X!=null&&X.errorInfo&&N&&he.getState().updateJob(N,{errorInfo:X.errorInfo})}if(Ie){t("> ── Build Error Output ──");const X=Ie.split(`
`).filter(Se=>Se.trim());for(const Se of X.slice(-60))t(">   "+Se);t("> ── End of Logs ──")}else if(t("> No detailed error logs available."),t("> Check the GitHub Actions run directly for full output."),N){const X=he.getState().getJob(N);X!=null&&X.repoUrl&&t("> "+X.repoUrl+"/actions")}r("Build failed. Check the logs above."),c==null||c("failure",{error:"Build failed",completedAt:Date.now()}),p==null||p({completedAt:Date.now()}),Qe=!0}else(M==null?void 0:M.status)==="waiting"?De%3===0&&t("> ... waiting for build to start"):De%3===0&&t("> ... compiling ("+De+"/"+Ge+")")}Qe||(t("> ⚠ Build timed out after 10 minutes."),r("Build timed out."),c==null||c("timeout",{completedAt:Date.now()}),p==null||p({completedAt:Date.now()}))}catch(pe){t("> ⚠ Cloud build error: "+((pe==null?void 0:pe.message)||"Unknown")),r((pe==null?void 0:pe.message)||"Build failed"),c==null||c("failure",{error:pe==null?void 0:pe.message,completedAt:Date.now()}),p==null||p({completedAt:Date.now()})}}async function ii(e,t,s,o,a,r,l,b,g){var P,N,c,p,S,u,x,y;try{await se(500);const{data:{session:I}}=await J.auth.getSession(),{data:w,error:v}=await J.functions.invoke("build-apk",{body:{action:"download",repoName:a,runId:r,userId:I==null?void 0:I.user.id,jobId:l}});if(v||!(w!=null&&w.artifactBase64)&&!((P=w==null?void 0:w.apk)!=null&&P.storagePath)&&!((N=w==null?void 0:w.aab)!=null&&N.storagePath)){e("> ⚠ Could not download APK automatically."),o("Could not download APK. Check GitHub Actions.");return}let H=null,Q=null,ce=null;if(w.artifactBase64){const A=atob(w.artifactBase64),j=new Uint8Array(A.length);for(let h=0;h<A.length;h++)j[h]=A.charCodeAt(h);ce=await st.loadAsync(j);const f=Object.keys(ce.files).find(h=>h.endsWith(".apk"));if(f){H=await ce.files[f].async("blob");try{e("> ── Validating APK ──");const h=await oo(ce);for(const U of no(h))e("> "+U)}catch{e("> ⚠ APK validation skipped")}t(H),l&&he.getState().updateJob(l,{apkBlob:H}),e("> ✓ APK extracted! ("+(H.size/(1024*1024)).toFixed(1)+" MB)")}const D=Object.keys(ce.files).find(h=>h.endsWith(".aab"));D&&(Q=await ce.files[D].async("blob"),e("> ✓ AAB extracted! ("+(Q.size/(1024*1024)).toFixed(1)+" MB)"))}try{const{data:{session:A}}=await J.auth.getSession();if(A&&l){const j={};let f=((c=w==null?void 0:w.apk)==null?void 0:c.storagePath)||null,D=((p=w==null?void 0:w.aab)==null?void 0:p.storagePath)||null;if(f)e(`> ✓ APK saved to cloud storage by server (${((((S=w.apk)==null?void 0:S.size)||0)/1048576).toFixed(1)} MB)`);else if(H){f=`${A.user.id}/${l}/app.apk`,e(`> Uploading APK to cloud storage (${(H.size/1048576).toFixed(1)} MB)...`);const{error:h}=await J.storage.from("build-artifacts").upload(f,H,{upsert:!0,contentType:"application/vnd.android.package-archive"});h&&(e("> ⚠ APK upload failed: "+h.message),f=null)}if(D)e("> ✓ AAB saved to cloud storage by server");else if(Q){D=`${A.user.id}/${l}/app.aab`;const{error:h}=await J.storage.from("build-artifacts").upload(D,Q,{upsert:!0,contentType:"application/octet-stream"});h&&(e("> ⚠ AAB upload failed: "+h.message),D=null)}if(f&&(j.apk_url=f),D&&(j.aab_url=D),Object.keys(j).length>0?(await J.from("builds").update(j).eq("id",l),he.getState().updateJob(l,{apkUrl:j.apk_url||void 0,aabUrl:j.aab_url||void 0}),e("> ✓ Artifacts recorded on builds table")):e("> ⚠ No artifact paths recorded — check GitHub Actions run for the raw files."),(u=w==null?void 0:w.keystore)!=null&&u.base64)try{const h=atob(w.keystore.base64),U=new Uint8Array(h.length);for(let oe=0;oe<h.length;oe++)U[oe]=h.charCodeAt(oe);const de=await st.loadAsync(U),me=Object.keys(de.files).find(oe=>oe.endsWith(".b64"));if(me){const oe=await de.files[me].async("text"),pe=atob(oe.trim()),ve=new Uint8Array(pe.length);for(let ue=0;ue<pe.length;ue++)ve[ue]=pe.charCodeAt(ue);const Fe=new Blob([ve],{type:"application/octet-stream"}),{data:Be}=await J.from("builds").select("project_id").eq("id",l).maybeSingle(),Ue=Be==null?void 0:Be.project_id,ne=`${A.user.id}/${Ue||l}/${Date.now()}-build.jks`,{error:Ye}=await J.storage.from("build-artifacts").upload(ne,Fe,{upsert:!0});!Ye&&Ue&&(await J.from("keystores").upsert({user_id:A.user.id,project_id:Ue,key_alias:"auto-generated",signing_mode:"debug",keystore_path:ne,is_active:!0,store_password_encrypted:"android",key_password_encrypted:"android"},{onConflict:"user_id,project_id,key_alias"}),e("> ✓ Keystore captured and saved"))}}catch{e("> ⚠ Keystore capture skipped")}if(w!=null&&w.fingerprints||(x=w==null?void 0:w.errorInfo)!=null&&x.fingerprints){const h=(w==null?void 0:w.fingerprints)||((y=w==null?void 0:w.errorInfo)==null?void 0:y.fingerprints);if(h!=null&&h.sha1||h!=null&&h.sha256)try{const{data:U}=await J.from("builds").select("project_id").eq("id",l).maybeSingle(),de=U==null?void 0:U.project_id,{data:me}=await J.from("keystores").select("id").eq("user_id",A.user.id).eq("project_id",de).order("created_at",{ascending:!1}).limit(1).maybeSingle();if(me)await J.from("keystores").update({sha1:h.sha1||null,sha256:h.sha256||null,md5:h.md5||null}).eq("id",me.id);else{const{error:oe}=await J.from("keystores").insert({user_id:A.user.id,project_id:de,key_alias:"auto-extracted",signing_mode:"debug",sha1:h.sha1||null,sha256:h.sha256||null,md5:h.md5||null,is_active:!0,store_password_encrypted:"android",key_password_encrypted:"android"});if(oe){console.warn("Keystore insert conflict, updating instead:",oe.message);const{data:pe}=await J.from("keystores").select("id").eq("user_id",A.user.id).eq("project_id",de).limit(1).maybeSingle();pe&&await J.from("keystores").update({sha1:h.sha1||null,sha256:h.sha256||null,md5:h.md5||null}).eq("id",pe.id)}}e("> ✓ Signing fingerprints saved to project")}catch{e("> ⚠ Could not save signing fingerprints")}}}}catch(A){e("> ⚠ Storage upload skipped: "+((A==null?void 0:A.message)||"Unknown"))}if(b==null||b("success",{completedAt:Date.now()}),g==null||g({completedAt:Date.now()}),a&&l){e("> ✓ Repository preserved for incremental rebuilds"),he.getState().updateJob(l,{sourceRepoName:a});try{await J.from("builds").update({source_repo_name:a}).eq("id",l)}catch{}}}catch(I){e("> ⚠ Download error: "+((I==null?void 0:I.message)||"Unknown")),o("Download failed.")}}function xo(){return`name: Build APK
on:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up JDK 21
        uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'
      - name: Setup Gradle
        uses: gradle/actions/setup-gradle@v4
      - name: Generate Gradle Wrapper
        run: |
          gradle wrapper --gradle-version 8.10.2
          chmod +x gradlew
      - name: Build Debug APK
        run: ./gradlew assembleDebug --no-daemon --stacktrace
      - name: Upload APK
        uses: actions/upload-artifact@v4
        with:
          name: debug-apk
          path: app/build/outputs/apk/debug/*.apk
          retention-days: 7
          if-no-files-found: error
`}const se=e=>new Promise(t=>setTimeout(t,e)),wo=e=>{switch(e){case"capacitor":return"Capacitor";case"ionic":return"Ionic + Capacitor";case"twa":return"TWA";case"electron":return"Electron";default:return"WebView"}},yo=[{pluginId:"google-auth",pluginName:"Google Auth (legacy)",secrets:[{key:"GOOGLE_CLIENT_ID",label:"Google OAuth Web Client ID",type:"text",placeholder:"xxxx.apps.googleusercontent.com",description:"From Google Cloud Console → Credentials → OAuth 2.0 Client ID (Web application)"},{key:"google-services.json",label:"google-services.json",type:"file",description:"Download from Firebase Console → Project Settings"}]},{pluginId:"capawesome-google-sign-in",pluginName:"Google Sign-In (Capawesome)",secrets:[{key:"GOOGLE_WEB_CLIENT_ID",label:"Web OAuth Client ID",type:"text",placeholder:"xxxx.apps.googleusercontent.com",description:"REQUIRED. Used as serverClientId on Android & iOS. Create a 'Web application' OAuth client in Google Cloud Console."},{key:"GOOGLE_IOS_CLIENT_ID",label:"iOS OAuth Client ID (optional)",type:"text",placeholder:"xxxx.apps.googleusercontent.com",description:"Only needed for native iOS sign-in. Create an 'iOS' OAuth client with your bundle ID."},{key:"GOOGLE_ANDROID_CLIENT_ID",label:"Android OAuth Client ID (optional)",type:"text",placeholder:"xxxx.apps.googleusercontent.com",description:"Create an 'Android' OAuth client with your package name + SHA-1 fingerprint. Used to authorize your app."},{key:"google-services.json",label:"google-services.json (optional)",type:"file",description:"Required only if you also use Firebase. Download from Firebase Console → Project Settings."}]},{pluginId:"capawesome-apple-sign-in",pluginName:"Apple Sign-In (Capawesome)",secrets:[{key:"APPLE_SERVICE_ID",label:"Apple Service ID",type:"text",placeholder:"com.example.signin",description:"From Apple Developer → Identifiers → Services IDs. Required for Web/Android."},{key:"APPLE_REDIRECT_URI",label:"Redirect URI",type:"text",placeholder:"https://your-app.com/auth/apple/callback",description:"Must match the Return URL configured in your Apple Service ID."}]},{pluginId:"capawesome-firebase-authentication",pluginName:"Firebase Authentication",secrets:[{key:"google-services.json",label:"google-services.json",type:"file",description:"Required for Android. Download from Firebase Console → Project Settings → Android app."},{key:"GoogleService-Info.plist",label:"GoogleService-Info.plist",type:"file",description:"Required for iOS. Download from Firebase Console → Project Settings → iOS app."},{key:"GOOGLE_WEB_CLIENT_ID",label:"Web OAuth Client ID (for Google sign-in)",type:"text",placeholder:"xxxx.apps.googleusercontent.com",description:"Required only if you enable Google as an auth provider."}]},{pluginId:"capawesome-oauth",pluginName:"OAuth 2.0 / OpenID Connect",secrets:[{key:"OAUTH_CLIENT_ID",label:"OAuth Client ID",type:"text",placeholder:"your-client-id",description:"From your OAuth provider (Auth0, Okta, Microsoft, etc.)"},{key:"OAUTH_AUTH_URL",label:"Authorization URL",type:"text",placeholder:"https://your-provider.com/oauth/authorize",description:"Authorization endpoint of your OAuth provider."},{key:"OAUTH_REDIRECT_URL",label:"Redirect URL",type:"text",placeholder:"com.yourapp://oauth/callback",description:"Custom URL scheme used to redirect back into your app."}]},{pluginId:"push",pluginName:"Push Notifications",secrets:[{key:"google-services.json",label:"google-services.json",type:"file",description:"Download from Firebase Console → Project Settings"}]},{pluginId:"push-notifications",pluginName:"Push Notifications",secrets:[{key:"google-services.json",label:"google-services.json",type:"file",description:"Download from Firebase Console → Project Settings"}]},{pluginId:"maps",pluginName:"Google Maps",secrets:[{key:"GOOGLE_MAPS_KEY",label:"Google Maps API Key",type:"text",placeholder:"AIza...",description:"From Google Cloud Console → APIs & Services → Credentials"}]},{pluginId:"facebook-login",pluginName:"Facebook Login",secrets:[{key:"FACEBOOK_APP_ID",label:"Facebook App ID",type:"text",placeholder:"123456789",description:"From Meta for Developers → App Dashboard"},{key:"FACEBOOK_CLIENT_TOKEN",label:"Facebook Client Token",type:"text",placeholder:"abc123...",description:"From Meta for Developers → Settings → Advanced → Client Token"}]},{pluginId:"iap",pluginName:"In-App Purchases",secrets:[{key:"IAP_PUBLIC_KEY",label:"Google Play License Key",type:"text",placeholder:"MIIBIjAN...",description:"From Google Play Console → Monetization → License"}]},{pluginId:"purchases",pluginName:"In-App Purchases",secrets:[{key:"IAP_PUBLIC_KEY",label:"Google Play License Key",type:"text",placeholder:"MIIBIjAN...",description:"From Google Play Console → Monetization → License"}]},{pluginId:"apple-sign-in",pluginName:"Sign in with Apple",secrets:[{key:"APPLE_SERVICE_ID",label:"Apple Service ID",type:"text",placeholder:"com.example.signin",description:"From Apple Developer → Identifiers → Services IDs"}]},{pluginId:"barcode",pluginName:"Barcode Scanner",secrets:[{key:"GOOGLE_ML_KEY",label:"Google ML Kit API Key (optional)",type:"text",placeholder:"AIza...",description:"Only needed for cloud-based scanning. On-device scanning works without a key."}]}],vo=({enabledPlugins:e,secrets:t,fileSecrets:s,onSecretChange:o,onFileSecretChange:a})=>{const r=yo.filter(l=>e.some(b=>b.includes(l.pluginId)));return r.length===0?null:i.jsxs("div",{className:"rounded-xl bg-card border border-border p-4 space-y-4",children:[i.jsxs("h3",{className:"text-sm font-semibold text-foreground flex items-center gap-2",children:[i.jsx(Kt,{size:14,className:"text-primary"}),"Plugin Credentials"]}),i.jsx("p",{className:"text-xs text-muted-foreground",children:"Some plugins require API keys or config files to work properly."}),r.map(l=>i.jsxs("div",{className:"space-y-3",children:[i.jsxs("div",{className:"text-xs font-medium text-foreground flex items-center gap-1.5",children:[i.jsx(Ai,{size:11,className:"text-[hsl(var(--warning))]"}),l.pluginName]}),l.secrets.map(b=>i.jsxs("div",{className:"space-y-1",children:[i.jsx(Li,{className:"text-xs text-muted-foreground",children:b.label}),b.type==="text"?i.jsx(Le,{type:"text",placeholder:b.placeholder,value:t[b.key]||"",onChange:g=>o(b.key,g.target.value),className:"bg-secondary border-border font-mono text-xs h-8"}):i.jsxs("div",{className:"flex items-center gap-2",children:[i.jsxs("label",{className:"flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-secondary text-xs text-muted-foreground cursor-pointer hover:border-primary/30 transition-colors",children:[i.jsx(Si,{size:12}),s[b.key]?s[b.key].name:"Choose file",i.jsx("input",{type:"file",accept:".json,.plist",className:"hidden",onChange:g=>{var N;const P=(N=g.target.files)==null?void 0:N[0];P&&a(b.key,P)}})]}),s[b.key]&&i.jsx(Wi,{size:14,className:"text-[hsl(var(--success))]"})]}),b.description&&i.jsx("p",{className:"text-[10px] text-muted-foreground",children:b.description})]},b.key))]},l.pluginId))]})},Wt="https://noiioxcxpvfzsqdayjfq.supabase.co/functions/v1/analyze-with-ai",Eo=()=>{var L,ie;const[e,t]=Ci(),{id:s}=Ni(),[o,a]=m.useState("drop"),[r,l]=m.useState(!1),[b,g]=m.useState(null),[P,N]=m.useState(""),[c,p]=m.useState(null),[S,u]=m.useState(""),[x,y]=m.useState(!1),[I,w]=m.useState(!1),[v,H]=m.useState([]),[Q,ce]=m.useState(""),[A,j]=m.useState("com.app.myapp"),[f,D]=m.useState("webview"),[h,U]=m.useState("apk"),[de,me]=m.useState(new Set(["windows"])),[oe,pe]=m.useState(!1),[ve,Fe]=m.useState(!1),[Be,Ue]=m.useState(null),[ne,Ye]=m.useState(null),[ue,Je]=m.useState(!1),[We,Ke]=m.useState("debug"),[Ee,Qe]=m.useState(""),[De,Ge]=m.useState("release-key"),[M,Ie]=m.useState(""),[X,Se]=m.useState({}),[d,ge]=m.useState({}),K=m.useRef(null),{files:ee,enabledPlugins:ke,loadFromZip:fe,setFiles:te,setBuildAppName:mt,setBuildPackageName:gt,setSelectedEngine:_}=Pe(),ae=he(n=>n.addJob),xe=e.get("rebuild"),R=e.get("appName"),Me=e.get("packageName"),ze=e.get("engine"),Ce=e.get("autostart")==="1";m.useEffect(()=>{xe&&R&&(ce(R),j(Me||"com.app.myapp"),ze&&D(ze),a("review"))},[xe,R,Me,ze]),m.useEffect(()=>{Q.trim()&&mt(Q.trim())},[Q,mt]),m.useEffect(()=>{A.trim()&&gt(A.trim())},[A,gt]),m.useEffect(()=>{_(f)},[f,_]),m.useEffect(()=>{!Ce||ee.length===0||oe||ve||o!=="review"||re()},[Ce,ee.length,oe,ve,o]);const Te=m.useCallback((n,T,B="active",Y)=>{const be=crypto.randomUUID();return H(Ae=>[...Ae,{id:be,type:n,title:T,status:B,startedAt:B==="active"?Date.now():void 0,detail:Y}]),be},[]),Ne=m.useCallback((n,T)=>{H(B=>B.map(Y=>Y.id===n?{...Y,...T}:Y))},[]),xt=m.useCallback((n,T)=>{if(!T)return null;const B=n.find(Y=>Y.path===T||Y.path.endsWith(T.split("/").pop()||""));if(B!=null&&B.binaryContent){const Y=B.extension||"png",be=Y==="ico"?"image/x-icon":Y==="svg"?"image/svg+xml":`image/${Y}`,Ae=new Blob([B.binaryContent],{type:be});return URL.createObjectURL(Ae)}return null},[]),V=m.useCallback(async(n,T,B,Y,be)=>{var Ae,Ze,k,$,Z,C;y(!0),u("");try{const E=await fetch(Wt,{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vaWlveGN4cHZmenNxZGF5amZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0Mzg5OTQsImV4cCI6MjA4NjAxNDk5NH0.uTEHnTzRWtJG7ngWT9-K8cbuOPAiqyKiRyHnTu_LdW4"},body:JSON.stringify({fileList:n,indexHtmlContent:T,packageJsonContent:B,totalFiles:Y,totalSize:be,stream:!0})});if(E.status===429){lt.error("Rate limit exceeded."),a("drop"),y(!1);return}if(E.status===402){lt.error("AI credits exhausted."),a("drop"),y(!1);return}if(!E.ok||!E.body)throw new Error("Stream failed");const le=E.body.getReader(),je=new TextDecoder;let ye="",Xe="",ft=!1;for(;!ft;){const{done:$e,value:et}=await le.read();if($e)break;ye+=je.decode(et,{stream:!0});let ot;for(;(ot=ye.indexOf(`
`))!==-1;){let Oe=ye.slice(0,ot);if(ye=ye.slice(ot+1),Oe.endsWith("\r")&&(Oe=Oe.slice(0,-1)),Oe.startsWith(":")||Oe.trim()===""||!Oe.startsWith("data: "))continue;const tt=Oe.slice(6).trim();if(tt==="[DONE]"){ft=!0;break}try{const Ct=(k=(Ze=(Ae=JSON.parse(tt).choices)==null?void 0:Ae[0])==null?void 0:Ze.delta)==null?void 0:k.content;Ct&&(Xe+=Ct,u(Xe))}catch{ye=Oe+`
`+ye;break}}}if(ye.trim())for(let $e of ye.split(`
`)){if(!$e||($e.endsWith("\r")&&($e=$e.slice(0,-1)),$e.startsWith(":")||$e.trim()==="")||!$e.startsWith("data: "))continue;const et=$e.slice(6).trim();if(et!=="[DONE]")try{const Oe=(C=(Z=($=JSON.parse(et).choices)==null?void 0:$[0])==null?void 0:Z.delta)==null?void 0:C.content;Oe&&(Xe+=Oe,u(Xe))}catch{}}y(!1)}catch(E){console.error("Stream error:",E),u("⚠️ AI analysis stream failed. Falling back to structured analysis..."),y(!1)}},[]),F=m.useCallback(async()=>{var n;a("analyzing"),u(""),H([]),w(!1);try{const T=Ve(ee),B=T.filter(E=>E.type==="file").map(E=>E.path),Y=T.find(E=>E.name==="index.html"),be=T.find(E=>E.name==="package.json"),Ae=`${(T.reduce((E,le)=>E+(le.size||0),0)/1024).toFixed(0)} KB`,Ze=Te("tool_call","Scanning project files","active");await new Promise(E=>setTimeout(E,300)),Ne(Ze,{status:"done",elapsed:.3,detail:`Found ${B.length} files (${Ae})`});const k=Te("thinking","Understanding project architecture","active"),$=V(B,(Y==null?void 0:Y.content)||null,(be==null?void 0:be.content)||null,B.length,Ae),Z=fetch(Wt,{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vaWlveGN4cHZmenNxZGF5amZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0Mzg5OTQsImV4cCI6MjA4NjAxNDk5NH0.uTEHnTzRWtJG7ngWT9-K8cbuOPAiqyKiRyHnTu_LdW4"},body:JSON.stringify({fileList:B,indexHtmlContent:(Y==null?void 0:Y.content)||null,packageJsonContent:(be==null?void 0:be.content)||null,totalFiles:B.length,totalSize:Ae})}).then(E=>E.ok?E.json():null).catch(()=>null),[,C]=await Promise.all([$,Z]);if(Ne(k,{status:"done",elapsed:2,detail:"Analysis complete"}),C&&!C.error){p(C),ce(C.appName||"MyApp"),D(C.suggestedEngine||"capacitor");const E=(C.appName||"myapp").toLowerCase().replace(/[^a-z0-9]/g,"");if(j(`com.app.${E}`),Te("tool_result",`Detected: ${C.appName} (${C.framework})`,"done",`Engine: ${C.suggestedEngine} — ${C.engineReason||"Best fit"}`),C.hasFavicon&&C.faviconPath){const le=xt(T,C.faviconPath);le&&Ye(le)}((n=C.suggestedPlugins)==null?void 0:n.length)>0&&Te("tool_result",`Suggested plugins: ${C.suggestedPlugins.join(", ")}`,"done"),Te("success",`Build confidence: ${C.assuranceMessage}`,"done")}else{const E=Pe.getState().scanResult;E&&p({appName:"MyApp",framework:E.framework,suggestedEngine:"capacitor",engineReason:"Capacitor provides the best native bridge",assurance:E.assurance,assuranceMessage:E.assuranceMessage,issues:E.issues}),ce("MyApp"),D("capacitor"),Te("success","Analysis complete (fallback mode)","done")}Te("question","Review the settings, then click Next to continue →","done"),w(!0)}catch(T){console.error("Analysis error:",T),lt.error("AI analysis failed. Using local analysis."),Te("error","Analysis failed — using defaults","error"),w(!0)}},[ee,xt,V,Te,Ne]);m.useEffect(()=>{ee.length>0&&o==="drop"&&b&&F()},[ee.length]);const z=async n=>{g(n.name),await fe(n)},qe=m.useCallback(n=>{n.preventDefault(),l(!1);const T=n.dataTransfer.files[0];T&&(T.name.endsWith(".zip")||T.name.endsWith(".tar.gz"))&&z(T)},[fe]),Re=()=>{if(!P.startsWith("http")){lt.error("Enter a valid URL starting with http");return}p({appName:new URL(P).hostname.split(".")[0]||"WebApp",framework:"Web URL",suggestedEngine:"webview",engineReason:"WebView is ideal for wrapping existing websites",assurance:"high",assuranceMessage:"URL-based apps have high build success rates"}),ce(new URL(P).hostname.split(".")[0]||"WebApp"),D("webview");const n=new URL(P).hostname.replace(/[^a-z0-9]/g,"");j(`com.app.${n}`),a("confirm")},q=()=>{a("review")},re=()=>{const n=[];if(Q.trim()||n.push("App name is required"),/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(A)||n.push("Invalid package name"),n.length){n.forEach(B=>lt.error(B));return}const T=crypto.randomUUID();ae({id:T,appName:Q,packageName:A,engine:f,status:"queued",stage:"Starting...",logs:[],startedAt:Date.now(),autoDeleteRepo:!0,projectId:s||void 0}),Ue(T),pe(!0)},we=n=>{me(T=>{const B=new Set(T);return B.has(n)?B.delete(n):B.add(n),B})},O=(c==null?void 0:c.assurance)==="high"?"shiny-assurance":(c==null?void 0:c.assurance)==="medium"?"shiny-assurance-medium":"shiny-assurance-low",G=()=>{a("drop"),te([]),g(null),p(null),pe(!1),Fe(!1),u(""),H([]),w(!1)},W=ee.length>0&&!b;return o==="drop"?W?i.jsxs("div",{className:"min-h-screen flex flex-col items-center justify-center px-4 py-8",children:[i.jsxs("div",{className:"text-center mb-6 sm:mb-8",children:[i.jsx("h1",{className:"text-2xl sm:text-3xl font-bold text-foreground mb-2",children:"Source Code Ready"}),i.jsxs("p",{className:"text-sm text-muted-foreground",children:["Using uploaded source code (",Ve(ee).filter(n=>n.type==="file").length," files)"]})]}),i.jsxs("div",{className:"w-full max-w-md space-y-4",children:[i.jsxs("div",{className:"rounded-xl bg-primary/5 border border-primary/20 p-4 flex items-center gap-3",children:[i.jsx(rt,{size:20,className:"text-primary shrink-0"}),i.jsxs("div",{children:[i.jsx("p",{className:"text-sm font-medium text-foreground",children:"Source code detected"}),i.jsx("p",{className:"text-xs text-muted-foreground",children:"Files from the Source Code page will be used for this build"})]})]}),i.jsxs(He,{size:"lg",className:"w-full gap-2 h-12",onClick:()=>{g("existing"),F()},children:[i.jsx(Nt,{size:18})," Analyze & Build"]}),i.jsxs("div",{className:"flex items-center gap-4",children:[i.jsx("div",{className:"flex-1 h-px bg-border"}),i.jsx("span",{className:"text-xs text-muted-foreground",children:"or"}),i.jsx("div",{className:"flex-1 h-px bg-border"})]}),i.jsxs(He,{variant:"outline",className:"w-full gap-2",onClick:()=>{te([])},children:[i.jsx(ct,{size:14})," Upload different source"]})]})]}):i.jsxs("div",{className:"min-h-screen flex flex-col items-center justify-center px-4 py-8",children:[i.jsxs("div",{className:"text-center mb-6 sm:mb-8",children:[i.jsx("h1",{className:"text-2xl sm:text-3xl font-bold text-foreground mb-2",children:"Drop your project"}),i.jsx("p",{className:"text-sm text-muted-foreground",children:"Upload a ZIP file or enter a URL — AI will handle the rest"})]}),i.jsxs("div",{onClick:()=>{var n;return(n=K.current)==null?void 0:n.click()},onDrop:qe,onDragOver:n=>{n.preventDefault(),l(!0)},onDragLeave:()=>l(!1),className:`drop-zone-circle cursor-pointer transition-all duration-300 ${r?"dragging scale-105":"hover:scale-[1.02]"}`,children:[i.jsx("div",{className:`outer-ring transition-all duration-500 ${r?"animate-[spin_8s_linear_infinite] border-primary/40":"animate-[spin_20s_linear_infinite]"}`}),i.jsxs("div",{className:`flex flex-col items-center transition-transform duration-300 ${r?"scale-110":""}`,children:[i.jsx(ct,{size:42,className:`mb-3 transition-colors duration-300 ${r?"text-primary":"text-muted-foreground"}`}),i.jsx("span",{className:"text-sm font-semibold text-foreground",children:"Drop ZIP here"}),i.jsx("span",{className:"text-xs text-primary mt-1 hover:underline",children:"or browse files"})]})]}),i.jsx("input",{ref:K,type:"file",accept:".zip,.tar.gz",onChange:n=>{var B;const T=(B=n.target.files)==null?void 0:B[0];T&&z(T)},className:"hidden"}),i.jsxs("div",{className:"flex items-center gap-4 my-6 sm:my-8 w-full max-w-md",children:[i.jsx("div",{className:"flex-1 h-px bg-border"}),i.jsx("span",{className:"text-xs text-muted-foreground",children:"or enter a URL"}),i.jsx("div",{className:"flex-1 h-px bg-border"})]}),i.jsxs("div",{className:"flex gap-2 w-full max-w-md",children:[i.jsx(Le,{type:"url",placeholder:"https://myapp.com",value:P,onChange:n=>N(n.target.value),className:"flex-1 bg-secondary border-border font-mono text-sm",onKeyDown:n=>n.key==="Enter"&&Re()}),i.jsxs(He,{onClick:Re,disabled:!P.startsWith("http"),children:[i.jsx(ji,{size:16,className:"mr-2"}),"Analyze"]})]}),i.jsxs("div",{className:"flex items-center gap-4 my-6 w-full max-w-md",children:[i.jsx("div",{className:"flex-1 h-px bg-border"}),i.jsxs("button",{onClick:()=>Je(!ue),className:"text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors",children:[i.jsx(Pi,{size:14}),"Import from GitHub"]}),i.jsx("div",{className:"flex-1 h-px bg-border"})]}),ue&&i.jsx("div",{className:"w-full max-w-md rounded-xl bg-card p-4",children:i.jsx(Ui,{onImported:()=>{g("GitHub Import"),F()}})})]}):o==="analyzing"?i.jsxs("div",{className:"h-screen flex flex-col",children:[i.jsxs("div",{className:"shrink-0 px-4 py-3 flex items-center gap-3 bg-background/80 backdrop-blur-md",children:[i.jsx("button",{onClick:G,className:"p-1 rounded-full hover:bg-muted transition-colors",children:i.jsx(yt,{size:16,className:"text-muted-foreground"})}),i.jsx("div",{className:"w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center",children:i.jsx(pt,{size:13,className:"text-primary"})}),i.jsx("span",{className:"text-sm font-semibold text-foreground",children:"ForgeAI"}),x&&i.jsx("span",{className:"ml-auto text-[11px] shimmer-text font-medium",children:"analyzing..."}),I&&!x&&i.jsxs(He,{size:"sm",className:"ml-auto gap-1.5 animate-fade-in",onClick:q,children:["Next ",i.jsx(jt,{size:14})]})]}),i.jsxs("div",{className:"flex-1 flex flex-col md:flex-row overflow-hidden",children:[i.jsxs("div",{className:"flex-1 md:w-[60%] overflow-y-auto p-4",children:[i.jsx(qt,{actions:v}),S&&i.jsx("div",{className:"mt-4 px-1",children:i.jsx("div",{className:`ai-chat-prose text-sm ${x?"ai-chat-streaming":""}`,children:S.split(`
`).map((n,T)=>i.jsx("p",{className:"text-foreground/80 leading-relaxed mb-1",children:n},T))})})]}),i.jsx("div",{className:"md:w-[40%] overflow-y-auto p-4 bg-card/50",children:i.jsxs("div",{className:"space-y-4",children:[i.jsx("h3",{className:"text-xs font-semibold text-muted-foreground uppercase tracking-wider",children:"Detected Settings"}),c?i.jsxs(i.Fragment,{children:[i.jsxs("div",{className:"space-y-3",children:[i.jsxs("div",{children:[i.jsx("span",{className:"text-muted-foreground text-[10px]",children:"App Name"}),i.jsx(Le,{value:Q,onChange:n=>ce(n.target.value),className:"mt-1 bg-secondary border-border text-sm h-9"})]}),i.jsxs("div",{children:[i.jsx("span",{className:"text-muted-foreground text-[10px]",children:"Package Name"}),i.jsx(Le,{value:A,onChange:n=>j(n.target.value),className:"mt-1 bg-secondary border-border font-mono text-xs h-9"})]}),i.jsxs("div",{children:[i.jsx("span",{className:"text-muted-foreground text-[10px]",children:"Framework"}),i.jsx("div",{className:"mt-1 text-sm text-foreground font-medium",children:c.framework})]}),i.jsxs("div",{children:[i.jsx("span",{className:"text-muted-foreground text-[10px]",children:"Engine"}),i.jsx("div",{className:"flex gap-1.5 mt-1 flex-wrap",children:["webview","capacitor","twa","ionic"].map(n=>i.jsx("button",{onClick:()=>D(n),className:`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${f===n?"bg-primary/15 text-primary border border-primary/30":"bg-muted/40 text-muted-foreground border border-transparent hover:border-border"}`,children:n.charAt(0).toUpperCase()+n.slice(1)},n))})]}),i.jsxs("div",{children:[i.jsx("span",{className:"text-muted-foreground text-[10px]",children:"Icon"}),i.jsx("div",{className:"mt-1 flex items-center gap-2",children:ne?i.jsx("img",{src:ne,alt:"App icon",className:"w-10 h-10 rounded-xl"}):i.jsx("div",{className:"w-10 h-10 rounded-xl bg-muted flex items-center justify-center",children:i.jsx(ct,{size:16,className:"text-muted-foreground"})})})]})]}),i.jsxs("div",{className:"rounded-lg bg-background/80 p-3 text-center",children:[i.jsx("span",{className:"text-[10px] font-semibold uppercase tracking-wider text-muted-foreground",children:"Build Confidence"}),i.jsx("p",{className:`text-sm font-bold mt-1 ${O}`,children:c.assuranceMessage})]})]}):i.jsx("div",{className:"flex items-center justify-center py-12",children:i.jsx(kt,{size:20,className:"animate-spin text-muted-foreground"})})]})})]})]}):o==="confirm"?i.jsx("div",{className:"min-h-screen flex flex-col items-center justify-center px-4 animate-fade-in",children:i.jsxs("div",{className:"w-full max-w-lg space-y-6",children:[i.jsxs("div",{className:"text-center",children:[i.jsx("div",{className:"w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4",children:i.jsx(rt,{size:28,className:"text-primary"})}),i.jsx("h2",{className:"text-2xl font-bold text-foreground mb-1",children:"Analysis Complete"}),i.jsx("p",{className:"text-muted-foreground text-sm",children:"Review the detected settings and proceed to build configuration"})]}),c&&i.jsxs("div",{className:"rounded-xl bg-card p-5 space-y-4",children:[i.jsxs("div",{className:"grid grid-cols-1 sm:grid-cols-2 gap-4",children:[i.jsxs("div",{children:[i.jsx("span",{className:"text-muted-foreground text-[10px] uppercase tracking-wider",children:"App Name"}),i.jsx(Le,{value:Q,onChange:n=>ce(n.target.value),className:"mt-1 bg-secondary border-border text-sm h-9"})]}),i.jsxs("div",{children:[i.jsx("span",{className:"text-muted-foreground text-[10px] uppercase tracking-wider",children:"Package"}),i.jsx(Le,{value:A,onChange:n=>j(n.target.value),className:"mt-1 bg-secondary border-border font-mono text-xs h-9"})]})]}),i.jsxs("div",{className:"flex items-center gap-3",children:[i.jsxs("div",{children:[i.jsx("span",{className:"text-muted-foreground text-[10px] uppercase tracking-wider",children:"Framework"}),i.jsx("p",{className:"text-sm font-medium text-foreground",children:c.framework})]}),i.jsxs("div",{className:"ml-auto",children:[i.jsx("span",{className:"text-muted-foreground text-[10px] uppercase tracking-wider",children:"Engine"}),i.jsx("p",{className:"text-sm font-medium text-primary capitalize",children:f})]})]}),i.jsxs("div",{className:"flex items-center gap-2",children:[ne?i.jsx("img",{src:ne,alt:"App icon",className:"w-10 h-10 rounded-xl"}):i.jsx("div",{className:"w-10 h-10 rounded-xl bg-muted flex items-center justify-center",children:i.jsx(ct,{size:16,className:"text-muted-foreground"})}),i.jsxs("div",{className:"flex-1",children:[i.jsx("div",{className:`text-sm font-bold ${O}`,children:c.assuranceMessage}),i.jsx("span",{className:"text-[10px] text-muted-foreground",children:"Build Confidence"})]})]})]}),i.jsxs("div",{className:"flex flex-col sm:flex-row gap-3",children:[i.jsxs(He,{variant:"outline",onClick:G,className:"flex-1 gap-2",children:[i.jsx(yt,{size:14})," Start Over"]}),i.jsxs(He,{onClick:q,className:"flex-1 gap-2",children:["Continue to Build ",i.jsx(jt,{size:14})]})]})]})}):i.jsxs("div",{className:"min-h-screen w-full pb-32",children:[i.jsxs("div",{className:"sticky top-0 z-20 bg-background/80 backdrop-blur-md px-4 py-3 flex items-center gap-3",children:[i.jsx("button",{onClick:()=>a("confirm"),className:"p-1.5 rounded-full hover:bg-muted transition-colors",children:i.jsx(yt,{size:18,className:"text-foreground"})}),i.jsx("h1",{className:"text-lg font-bold text-foreground",children:"Build Configuration"}),c&&i.jsxs("span",{className:"ml-auto text-xs text-muted-foreground flex items-center gap-1",children:[i.jsx(pt,{size:12,className:"text-primary"})," AI-powered"]})]}),i.jsxs("div",{className:"px-4 py-4 max-w-2xl mx-auto space-y-6",children:[c&&i.jsxs("div",{className:"rounded-xl bg-card border border-border p-5 text-center",children:[i.jsxs("div",{className:"flex items-center justify-center gap-2 mb-2",children:[c.assurance==="high"?i.jsx(Ii,{size:20,className:"text-primary"}):c.assurance==="medium"?i.jsx(Pt,{size:20,className:"text-[hsl(var(--warning))]"}):i.jsx(ht,{size:20,className:"text-destructive"}),i.jsx("span",{className:"text-xs font-semibold uppercase tracking-wider text-muted-foreground",children:"Build Confidence"})]}),i.jsx("p",{className:`text-lg font-bold ${O}`,children:c.assuranceMessage})]}),c&&i.jsxs("div",{className:"rounded-xl bg-card border border-border p-4 space-y-4",children:[i.jsxs("h3",{className:"text-sm font-semibold text-foreground flex items-center gap-2",children:[i.jsx(Jt,{size:14,className:"text-primary"})," Detected by AI"]}),i.jsxs("div",{className:"grid grid-cols-2 gap-3 text-sm",children:[i.jsxs("div",{children:[i.jsx("span",{className:"text-muted-foreground text-xs",children:"App Name"}),i.jsx(Le,{value:Q,onChange:n=>ce(n.target.value),className:"mt-1 bg-secondary border-border text-sm h-9"})]}),i.jsxs("div",{children:[i.jsx("span",{className:"text-muted-foreground text-xs",children:"Package Name"}),i.jsx(Le,{value:A,onChange:n=>j(n.target.value),className:"mt-1 bg-secondary border-border font-mono text-xs h-9"})]}),i.jsxs("div",{children:[i.jsx("span",{className:"text-muted-foreground text-xs",children:"Framework"}),i.jsx("div",{className:"mt-1 text-foreground font-medium",children:c.framework})]}),i.jsxs("div",{children:[i.jsx("span",{className:"text-muted-foreground text-xs",children:"Icon"}),i.jsxs("div",{className:"mt-1 flex items-center gap-2",children:[ne?i.jsx("img",{src:ne,alt:"App icon",className:"w-8 h-8 rounded-lg"}):i.jsx("div",{className:"w-8 h-8 rounded-lg bg-muted flex items-center justify-center",children:i.jsx(ct,{size:14,className:"text-muted-foreground"})}),i.jsx("span",{className:"text-xs text-muted-foreground",children:ne?"From project":"Default icon"})]})]})]})]}),c&&i.jsxs("div",{className:"rounded-xl bg-card border border-border p-4",children:[i.jsxs("h3",{className:"text-sm font-semibold text-foreground mb-2 flex items-center gap-2",children:[i.jsx(pt,{size:14,className:"text-primary"})," Recommended Engine"]}),i.jsxs("div",{className:"flex items-center gap-3 mb-2",children:[i.jsx("span",{className:"text-foreground font-bold capitalize",children:f}),c.engineReason&&i.jsxs("span",{className:"text-xs text-muted-foreground",children:["— ",c.engineReason]})]}),i.jsx("div",{className:"flex gap-2 flex-wrap",children:["webview","capacitor","twa","ionic","electron"].map(n=>i.jsx("button",{onClick:()=>D(n),className:`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${f===n?"bg-primary/15 text-primary border border-primary/30":"bg-muted/40 text-muted-foreground border border-transparent hover:border-border"}`,children:n.charAt(0).toUpperCase()+n.slice(1)},n))})]}),(c==null?void 0:c.issues)&&c.issues.length>0&&i.jsxs("div",{className:"rounded-xl bg-card border border-border p-4",children:[i.jsxs("h3",{className:"text-sm font-semibold text-foreground mb-3 flex items-center gap-2",children:[i.jsx(ht,{size:14,className:"text-[hsl(var(--warning))]"})," Issues Found (",c.issues.length,")"]}),i.jsx("div",{className:"space-y-1.5 max-h-48 overflow-y-auto",children:c.issues.slice(0,15).map((n,T)=>i.jsxs("div",{className:"flex items-start gap-2 text-xs",children:[n.severity==="error"?i.jsx(ht,{size:12,className:"text-destructive mt-0.5 shrink-0"}):n.severity==="warning"?i.jsx(ht,{size:12,className:"text-[hsl(var(--warning))] mt-0.5 shrink-0"}):i.jsx(Pt,{size:12,className:"text-[hsl(var(--info))] mt-0.5 shrink-0"}),i.jsxs("span",{className:"text-muted-foreground",children:[n.file&&i.jsxs("span",{className:"text-foreground font-mono",children:[n.file,": "]}),n.message]})]},T))})]}),!oe&&!ve&&i.jsxs("div",{className:"rounded-xl bg-card border border-border p-4",children:[i.jsx("h3",{className:"text-sm font-semibold text-foreground mb-3",children:"Build Target"}),i.jsx("div",{className:"grid grid-cols-2 sm:grid-cols-4 gap-3",children:[{mode:"apk",icon:i.jsx("img",{src:_i,alt:"Android",className:"w-7 h-7"}),label:"Android",sub:"APK / AAB"},{mode:"ios",icon:i.jsx("img",{src:Ei,alt:"iOS",className:"w-7 h-7"}),label:"iOS",sub:"iPhone / iPad"},{mode:"desktop",icon:i.jsx(Di,{size:24,className:h==="desktop"?"text-primary":""}),label:"Desktop",sub:"Electron"},{mode:"project",icon:i.jsx(Gi,{size:24,className:h==="project"?"text-primary":""}),label:"ZIP",sub:"Project files"}].map(n=>i.jsxs("button",{onClick:()=>U(n.mode),className:`flex flex-col items-center gap-2 rounded-xl border px-3 py-4 transition-all ${h===n.mode?"border-primary bg-primary/5 text-foreground":"border-border text-muted-foreground hover:border-muted-foreground/40"}`,children:[n.icon,i.jsxs("div",{className:"text-center",children:[i.jsx("div",{className:"text-xs font-medium",children:n.label}),i.jsx("div",{className:"text-[10px] text-muted-foreground",children:n.sub})]})]},n.mode))}),h==="desktop"&&i.jsx("div",{className:"mt-4 flex gap-2",children:[{id:"windows",label:"Windows",icon:Ri},{id:"macos",label:"macOS",icon:Ti},{id:"linux",label:"Linux",icon:$i}].map(n=>i.jsxs("button",{onClick:()=>we(n.id),className:`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${de.has(n.id)?"border-primary bg-primary/10 text-foreground":"border-border text-muted-foreground hover:border-muted-foreground/40"}`,children:[i.jsx("img",{src:n.icon,alt:n.label,className:"w-4 h-4"})," ",n.label]},n.id))})]}),!oe&&!ve&&h==="apk"&&i.jsxs("div",{className:"rounded-xl bg-card border border-border p-4 space-y-3",children:[i.jsxs("h3",{className:"text-sm font-semibold text-foreground flex items-center gap-2",children:[i.jsx(Vi,{size:14,className:"text-primary"})," Signing Configuration"]}),i.jsxs("div",{className:"flex gap-2",children:[i.jsx("button",{onClick:()=>Ke("debug"),className:`flex-1 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${We==="debug"?"border-primary bg-primary/10 text-foreground":"border-border text-muted-foreground hover:border-border/80"}`,children:"Debug (default)"}),i.jsx("button",{onClick:()=>Ke("release"),className:`flex-1 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${We==="release"?"border-primary bg-primary/10 text-foreground":"border-border text-muted-foreground hover:border-border/80"}`,children:"Release"})]}),We==="release"&&i.jsxs("div",{className:"space-y-2 pt-1",children:[i.jsxs("div",{children:[i.jsx("span",{className:"text-muted-foreground text-[10px]",children:"Key Alias"}),i.jsx(Le,{value:De,onChange:n=>Ge(n.target.value),className:"bg-secondary border-border text-xs h-8 mt-0.5"})]}),i.jsxs("div",{children:[i.jsx("span",{className:"text-muted-foreground text-[10px]",children:"Keystore Password"}),i.jsx(Le,{type:"password",value:Ee,onChange:n=>Qe(n.target.value),className:"bg-secondary border-border text-xs h-8 mt-0.5",placeholder:"••••••••"})]}),i.jsxs("div",{children:[i.jsx("span",{className:"text-muted-foreground text-[10px]",children:"Key Password"}),i.jsx(Le,{type:"password",value:M,onChange:n=>Ie(n.target.value),className:"bg-secondary border-border text-xs h-8 mt-0.5",placeholder:"••••••••"})]}),i.jsxs("p",{className:"text-[10px] text-muted-foreground flex items-center gap-1",children:[i.jsx(Kt,{size:10})," A debug keystore will be auto-generated if no release keystore is configured."]})]})]}),!oe&&!ve&&i.jsx(vo,{enabledPlugins:Array.from(ke),secrets:X,fileSecrets:d,onSecretChange:(n,T)=>Se(B=>({...B,[n]:T})),onFileSecretChange:(n,T)=>ge(B=>({...B,[n]:T}))}),!oe&&!ve&&i.jsxs(i.Fragment,{children:[((c==null?void 0:c.assurance)==="low"||((L=c==null?void 0:c.issues)==null?void 0:L.some(n=>n.severity==="error")))&&i.jsxs("div",{className:"rounded-xl bg-destructive/5 border border-destructive/20 p-4 text-sm text-destructive",children:[i.jsx("p",{className:"font-semibold mb-1",children:"❌ Build Blocked"}),i.jsx("p",{className:"text-xs",children:"Your project has critical issues that must be resolved before building."})]}),i.jsxs(He,{size:"lg",className:"w-full gap-2 h-12 text-base",onClick:re,disabled:!Q.trim()||(c==null?void 0:c.assurance)==="low"||!!((ie=c==null?void 0:c.issues)!=null&&ie.some(n=>n.severity==="error")),children:[i.jsx(Nt,{size:18}),h==="apk"?"Build Android APK":h==="ios"?"Build iOS App":h==="desktop"?"Build Desktop App":"Generate Project ZIP"]})]}),(oe||ve)&&i.jsx("div",{className:"rounded-xl border border-border p-4",children:i.jsx(ho,{isBuilding:oe,onBuildComplete:()=>{pe(!1),Fe(!0)},engine:f,enabledPlugins:Array.from(ke),appName:Q,packageName:A,url:P||void 0,outputMode:h==="desktop"?"desktop":h,jobId:Be||void 0,desktopPlatforms:h==="desktop"?Array.from(de):void 0,signingMode:We,keystorePassword:Ee||void 0,keyAlias:De||void 0,keyPassword:M||void 0,iconDataUrl:ne,projectId:s||void 0})}),ve&&i.jsxs("div",{className:"rounded-xl bg-primary/5 border border-primary/20 p-4 text-center",children:[i.jsx("p",{className:"text-sm text-foreground mb-3",children:"Build queued. Track it in the Builds page."}),i.jsx(He,{variant:"outline",onClick:()=>t({view:"builds"}),className:"gap-2",children:"Go to Builds"})]})]})]})};export{Eo as default};
