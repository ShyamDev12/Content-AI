
import { NextResponse } from 'next/server';
import { generateMarketingCopy } from '@/ai/flows/generate-marketing-copy-flow';
import { generateVisualAssets } from '@/ai/flows/generate-visual-assets-flow';
import { checkBrandCompliance } from '@/ai/flows/check-brand-compliance';

export const maxDuration = 120; // Ensure enough time for parallel image generation

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prd_text, category, sub_category, length_type, reference_image } = body;

    if (!prd_text || prd_text.trim().length < 10) {
      return NextResponse.json({ error: 'Detailed product information required.' }, { status: 400 });
    }

    // 1. Copywriter & Strategy Agent
    const copyOutput = await generateMarketingCopy({ prd_text });

    const finalCategory = (category === 'Auto-Detect' || !category) ? (copyOutput.product_category || 'Product') : category;
    const finalSubCategory = (sub_category === 'Auto-Detect' || !sub_category) ? '' : sub_category;

    // 2. Vision Engine Agent (Parallelized with Compliance)
    const visualInput = {
      productCategory: finalCategory,
      productDescription: copyOutput.blog_post.substring(0, 500),
      referenceImage: reference_image || undefined,
      anatomicalSpecs: (finalCategory.toLowerCase().includes('jewelry') && finalSubCategory.toLowerCase().includes('necklace')) 
        ? (length_type || 'Princess') + ' length'
        : copyOutput.anatomical_specs
    };

    const [visualOutput, complianceOutput] = await Promise.all([
      generateVisualAssets(visualInput),
      checkBrandCompliance({ copy: copyOutput.blog_post })
    ]);

    return NextResponse.json({
      success: true,
      campaign: {
        id: Math.random().toString(36).substring(7),
        copy: {
          ...copyOutput,
          redlined_blog: complianceOutput.redlined_copy,
          is_compliant: complianceOutput.is_compliant,
          flagged_words: complianceOutput.flagged_words
        },
        visuals: visualOutput,
        metadata: {
          category: finalCategory,
          subCategory: finalSubCategory,
          vibe: copyOutput.campaign_vibe,
          audience: copyOutput.target_audience
        }
      }
    });

  } catch (error: any) {
    console.error('Orchestration Error:', error);
    // Standardize error responses to avoid HTML SyntaxErrors on the client
    return NextResponse.json({ 
      error: error.message || 'The multi-agent pipeline encountered a synchronization error.' 
    }, { status: 500 });
  }
}
