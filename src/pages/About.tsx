import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import NativeBridgeLogo from "@/components/layout/NativeBridgeLogo";
import { Users, Zap, Globe, Shield, Target, Heart } from "lucide-react";

const values = [
  { icon: Target, title: "Developer-first", desc: "Every feature is designed for web developers who want to ship mobile apps without learning native development." },
  { icon: Zap, title: "Speed matters", desc: "From upload to APK in under 5 minutes. We optimize every step of the build pipeline so you can ship faster." },
  { icon: Shield, title: "Reliability", desc: "Cloud builds on enterprise infrastructure. No flaky local environments, no dependency conflicts, no surprises." },
  { icon: Globe, title: "Open standards", desc: "Built on Capacitor, Ionic, and web standards. Your code is never locked in — you can always eject and build locally." },
  { icon: Users, title: "Community", desc: "We're building NativeBridge in the open. Join our community of web developers shipping native apps worldwide." },
  { icon: Heart, title: "Accessibility", desc: "Native apps should be accessible to every developer, not just those with years of mobile experience." },
];

const stats = [
  { stat: "4", label: "Build engines" },
  { stat: "12+", label: "Native plugins" },
  { stat: "< 5 min", label: "Average build time" },
  { stat: "0", label: "Lines of native code required" },
];

const About = () => {
  return (
    <div
      className="min-h-screen bg-white"
      style={{ fontFamily: "'Google Sans', 'Google Sans Text', sans-serif" }}
    >
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex justify-center mb-8">
            <NativeBridgeLogo size={64} />
          </div>
          <h1 className="text-[#202124] text-4xl sm:text-5xl font-normal mb-6" style={{ fontFamily: "'Google Sans', sans-serif" }}>
            About NativeBridge
          </h1>
          <p className="text-[#5f6368] text-lg leading-relaxed max-w-2xl mx-auto" style={{ fontFamily: "'Google Sans Text', sans-serif" }}>
            We're on a mission to make native mobile app development accessible to every web developer. If you can build a web app, you should be able to ship a native app.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="py-12 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="space-y-6 text-[#5f6368] text-base leading-relaxed" style={{ fontFamily: "'Google Sans Text', sans-serif" }}>
            <p>
              Every day, thousands of developers build amazing web applications using tools like <strong className="text-[#202124]">Lovable, Bolt, v0, React, Vue, and Angular</strong>. These AI-powered platforms and frameworks make it incredibly easy to go from idea to working web app in minutes.
            </p>
            <p>
              But when it comes time to publish on mobile app stores, the process becomes overwhelming — Android Studio, Gradle configurations, Java/Kotlin, Xcode, signing certificates, provisioning profiles, and hours of environment setup. The gap between "I have a web app" and "I have a mobile app" is massive.
            </p>
            <p>
              <strong className="text-[#202124]">NativeBridge closes that gap.</strong> We handle all the native tooling in the cloud — so you upload your source code, pick your build engine, and get a production-ready APK in minutes. No Android Studio. No JDK. No Xcode. Just your web app, transformed into a native mobile experience.
            </p>
            <p>
              Whether you built your app with Lovable AI, coded it by hand, or used any other tool — NativeBridge is the next step. <strong className="text-[#202124]">Build it once. Ship it everywhere.</strong>
            </p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {stats.map((item) => (
              <div key={item.label} className="text-center p-6 rounded-xl border border-[#e8eaed]">
                <div className="text-[#1a73e8] text-3xl font-normal mb-1" style={{ fontFamily: "'Google Sans', sans-serif" }}>
                  {item.stat}
                </div>
                <div className="text-[#5f6368] text-sm" style={{ fontFamily: "'Google Sans Text', sans-serif" }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-12 px-6 pb-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-[#202124] text-2xl font-medium text-center mb-12" style={{ fontFamily: "'Google Sans', sans-serif" }}>
            What we believe
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
            {values.map((v) => (
              <div key={v.title} className="text-center">
                <div className="w-12 h-12 rounded-xl bg-[#e8f0fe] flex items-center justify-center mb-4 mx-auto">
                  <v.icon size={24} className="text-[#1a73e8]" />
                </div>
                <h3 className="text-[#202124] text-base font-medium mb-2" style={{ fontFamily: "'Google Sans', sans-serif" }}>{v.title}</h3>
                <p className="text-[#5f6368] text-sm leading-relaxed" style={{ fontFamily: "'Google Sans Text', sans-serif" }}>{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default About;
