# Engine Pipeline Update
1. Created `build-desktop-electron` and `build-desktop-tauri` edge functions.
2. The UI (`EngineSelector`, `CreateFlow`, `GeneralSettings`, `AnalyticsDashboard`) now includes `tauri`.
3. The frontend `BuildPipeline` calls `supabase.functions.invoke(\`build-desktop-\${engine === "electron" ? "electron" : "tauri"}\`)`.
