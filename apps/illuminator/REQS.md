1) the purpose of this  system is to generate short form content that sits at a graph level above an entity, but below an era - it should be content about a collection of   entities and their relatinships. 
2) this system should use the lore-wewave output (includeing lore events) as the structural basis of the content.  the llm is just responsible for selecting entities and writeing createive prose. 'dressing the skeleton' 
3) the prompts in the pipeline exisin to create a cohesive story. the goal of the narrative styles is to force the llm creation process to come up with meningfully diffrent types of content.
4) to support this, there should be N schemas and propmt structures that support diffrent types of content generation.  the cohesive elements for a
   romance story are very diffrent then the cohesive elemtents for a religious text or collection of personal letters.  this should be implemented as at
   least 2 parallel pipeline implemnetations (that share things like entity selection, error handlinig, etc) with the possibility to extend to more in
   the future (first 2 are just short story and document).  
5) 