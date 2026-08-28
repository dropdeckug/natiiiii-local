import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import ProductGrid from "@/components/landing/ProductGrid";
import Features from "@/components/landing/Features";
import Community from "@/components/landing/Community";
import Footer from "@/components/landing/Footer";

const Landing = () => {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      <Navbar />
      <main>
        <Hero />
        <ProductGrid />
        <Features />
        <Community />
      </main>
      <Footer />
    </div>
  );
};

export default Landing;
