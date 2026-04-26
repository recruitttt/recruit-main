interface FrameworkRule {
  name: string;
  category: string;
  ecosystems: ReadonlyArray<"npm" | "pip" | "go" | "cargo" | "rubygems" | "pub" | "composer" | "maven" | "gradle">;
  packagePatterns: RegExp[];
}

const RULES: FrameworkRule[] = [
  // Frontend - React ecosystem
  { name: "React", category: "Frontend", ecosystems: ["npm"], packagePatterns: [/^react$/] },
  { name: "Next.js", category: "Frontend", ecosystems: ["npm"], packagePatterns: [/^next$/] },
  { name: "Remix", category: "Frontend", ecosystems: ["npm"], packagePatterns: [/^@remix-run\//] },
  { name: "Gatsby", category: "Frontend", ecosystems: ["npm"], packagePatterns: [/^gatsby$/] },
  // Frontend - other
  { name: "Vue", category: "Frontend", ecosystems: ["npm"], packagePatterns: [/^vue$/] },
  { name: "Nuxt", category: "Frontend", ecosystems: ["npm"], packagePatterns: [/^nuxt$/, /^@nuxt\//] },
  { name: "Svelte", category: "Frontend", ecosystems: ["npm"], packagePatterns: [/^svelte$/, /^@sveltejs\//] },
  { name: "SolidJS", category: "Frontend", ecosystems: ["npm"], packagePatterns: [/^solid-js$/] },
  { name: "Astro", category: "Frontend", ecosystems: ["npm"], packagePatterns: [/^astro$/] },
  { name: "Angular", category: "Frontend", ecosystems: ["npm"], packagePatterns: [/^@angular\/core$/] },
  // Styling
  { name: "Tailwind CSS", category: "Styling", ecosystems: ["npm"], packagePatterns: [/^tailwindcss$/] },
  // Backend - JS
  { name: "Express", category: "Backend", ecosystems: ["npm"], packagePatterns: [/^express$/] },
  { name: "Fastify", category: "Backend", ecosystems: ["npm"], packagePatterns: [/^fastify$/] },
  { name: "NestJS", category: "Backend", ecosystems: ["npm"], packagePatterns: [/^@nestjs\/core$/] },
  { name: "Hono", category: "Backend", ecosystems: ["npm"], packagePatterns: [/^hono$/] },
  // Backend - Python
  { name: "Django", category: "Backend", ecosystems: ["pip"], packagePatterns: [/^django$/] },
  { name: "FastAPI", category: "Backend", ecosystems: ["pip"], packagePatterns: [/^fastapi$/] },
  { name: "Flask", category: "Backend", ecosystems: ["pip"], packagePatterns: [/^flask$/] },
  // Backend - other
  { name: "Rails", category: "Backend", ecosystems: ["rubygems"], packagePatterns: [/^rails$/] },
  { name: "Laravel", category: "Backend", ecosystems: ["composer"], packagePatterns: [/^laravel\/framework$/] },
  { name: "Spring Boot", category: "Backend", ecosystems: ["maven", "gradle"], packagePatterns: [/spring-boot/] },
  { name: "Gin", category: "Backend", ecosystems: ["go"], packagePatterns: [/gin-gonic\/gin/] },
  { name: "Actix Web", category: "Backend", ecosystems: ["cargo"], packagePatterns: [/^actix-web$/] },
  { name: "Axum", category: "Backend", ecosystems: ["cargo"], packagePatterns: [/^axum$/] },
  // ML/Data
  { name: "PyTorch", category: "ML", ecosystems: ["pip"], packagePatterns: [/^torch$/] },
  { name: "TensorFlow", category: "ML", ecosystems: ["pip"], packagePatterns: [/^tensorflow$/] },
  { name: "scikit-learn", category: "ML", ecosystems: ["pip"], packagePatterns: [/^scikit-learn$/] },
  { name: "pandas", category: "Data", ecosystems: ["pip"], packagePatterns: [/^pandas$/] },
  { name: "NumPy", category: "Data", ecosystems: ["pip"], packagePatterns: [/^numpy$/] },
  // Mobile
  { name: "React Native", category: "Mobile", ecosystems: ["npm"], packagePatterns: [/^react-native$/] },
  { name: "Expo", category: "Mobile", ecosystems: ["npm"], packagePatterns: [/^expo$/] },
  { name: "Flutter", category: "Mobile", ecosystems: ["pub"], packagePatterns: [/^flutter$/] },
  // Testing
  { name: "Jest", category: "Testing", ecosystems: ["npm"], packagePatterns: [/^jest$/] },
  { name: "Vitest", category: "Testing", ecosystems: ["npm"], packagePatterns: [/^vitest$/] },
  { name: "Playwright", category: "Testing", ecosystems: ["npm"], packagePatterns: [/^@playwright\/test$/] },
  { name: "Cypress", category: "Testing", ecosystems: ["npm"], packagePatterns: [/^cypress$/] },
  { name: "pytest", category: "Testing", ecosystems: ["pip"], packagePatterns: [/^pytest$/] },
];

const DATABASE_RULES: Array<{ name: string; ecosystems: FrameworkRule["ecosystems"]; patterns: RegExp[] }> = [
  { name: "PostgreSQL", ecosystems: ["npm", "pip", "go"], patterns: [/^pg$/, /^postgres$/, /^psycopg/, /pgx/] },
  { name: "MySQL", ecosystems: ["npm", "pip", "go"], patterns: [/^mysql$/, /^mysql2$/, /^pymysql$/, /go-sql-driver\/mysql/] },
  { name: "MongoDB", ecosystems: ["npm", "pip"], patterns: [/^mongodb$/, /^mongoose$/, /^pymongo$/] },
  { name: "Redis", ecosystems: ["npm", "pip"], patterns: [/^redis$/, /^ioredis$/] },
  { name: "SQLite", ecosystems: ["npm", "pip"], patterns: [/sqlite/, /better-sqlite3/, /libsql/] },
  { name: "Supabase", ecosystems: ["npm"], patterns: [/^@supabase\/supabase-js$/] },
  { name: "Prisma", ecosystems: ["npm"], patterns: [/^prisma$/, /^@prisma\/client$/] },
  { name: "Drizzle", ecosystems: ["npm"], patterns: [/^drizzle-orm$/] },
];

export function inferFrameworks(
  manifests: ReadonlyArray<{ ecosystem: string; dependencies: string[]; devDependencies?: string[] }>,
): { name: string; category: string; evidence: { ecosystem: string; dep: string } }[] {
  const out = new Map<string, { name: string; category: string; evidence: { ecosystem: string; dep: string } }>();
  for (const m of manifests) {
    const allDeps = [...m.dependencies, ...(m.devDependencies ?? [])];
    for (const dep of allDeps) {
      for (const rule of RULES) {
        if (!rule.ecosystems.includes(m.ecosystem as never)) continue;
        if (rule.packagePatterns.some((p) => p.test(dep))) {
          if (!out.has(rule.name)) {
            out.set(rule.name, {
              name: rule.name,
              category: rule.category,
              evidence: { ecosystem: m.ecosystem, dep },
            });
          }
        }
      }
    }
  }
  return Array.from(out.values());
}

export function inferDatabases(
  manifests: ReadonlyArray<{ ecosystem: string; dependencies: string[]; devDependencies?: string[] }>,
): string[] {
  const out = new Set<string>();
  for (const m of manifests) {
    const allDeps = [...m.dependencies, ...(m.devDependencies ?? [])];
    for (const dep of allDeps) {
      for (const rule of DATABASE_RULES) {
        if (!rule.ecosystems.includes(m.ecosystem as never)) continue;
        if (rule.patterns.some((p) => p.test(dep))) out.add(rule.name);
      }
    }
  }
  return Array.from(out);
}
