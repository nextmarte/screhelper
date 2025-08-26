# **App Name**: ScreHelper

## Core Features:

- Import XLSX Data: Accept user-uploaded XLSX files containing a list of scientific articles with title, abstract, and other fields.
- Define Criteria: Allow users to define inclusion and exclusion criteria through a form interface.
- AI-Powered Analysis: Analyze the title and abstract of each article against the user-defined inclusion and exclusion criteria using the Gemini API. The LLM will act as a tool that decides, according to the instructions in the criteria, whether to include information in its answer or not.
- Display Classification: Display the classification results for each article, highlighting whether it meets the inclusion or exclusion criteria.
- Export Classified Data: Export the classified data to a new XLSX file with an added column indicating the classification result for each article.
- Multiple Criteria Support: Allow users to add as many inclusion and exclusion criteria as they deem necessary.

## Style Guidelines:

- Primary color: Deep indigo (#4B0082) for a scholarly, intellectual feel.
- Background color: Very light lavender (#F0F8FF). A hue similar to indigo will subtly unify the design while minimizing distraction.
- Accent color: Muted gold (#B8860B) for highlighting key elements and actions.
- Body and headline font: 'Literata', a transitional serif (paired with a sans-serif such as 'Inter' if a bolder design is desired).
- Clean and structured layout to easily visualize and interact with the data and analysis results.
- Use clear, scientific-style icons to represent actions such as import, export, and analysis.
- Subtle animations when the Gemini API classifies data. A loading bar may also be shown.