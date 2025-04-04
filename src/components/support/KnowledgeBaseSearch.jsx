import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Search, 
  BookOpen, 
  Loader2, 
  ThumbsUp, 
  ThumbsDown,
  ChevronRight,
  Tag
} from "lucide-react";

export default function KnowledgeBaseSearch({ articles, isLoading }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [expandedArticle, setExpandedArticle] = useState(null);

  const filteredArticles = articles.filter(article => 
    article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    article.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    article.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const categoryLabels = {
    faq: "FAQ",
    guide: "Guia",
    troubleshooting: "Solução de Problemas",
    tutorial: "Tutorial",
    announcement: "Comunicado"
  };

  const categoryColors = {
    faq: "bg-blue-100 text-blue-800 border-blue-200",
    guide: "bg-green-100 text-green-800 border-green-200",
    troubleshooting: "bg-red-100 text-red-800 border-red-200",
    tutorial: "bg-purple-100 text-purple-800 border-purple-200",
    announcement: "bg-yellow-100 text-yellow-800 border-yellow-200"
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Base de Conhecimento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  type="search"
                  placeholder="Pesquisar artigos..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
              ) : filteredArticles.length === 0 ? (
                <div className="text-center py-8">
                  <BookOpen className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-semibold text-gray-900">
                    Nenhum artigo encontrado
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Tente pesquisar com outros termos
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredArticles.map((article) => (
                    <Button
                      key={article.id}
                      variant="ghost"
                      className={`w-full justify-start text-left ${
                        expandedArticle?.id === article.id ? "bg-blue-50" : ""
                      }`}
                      onClick={() => setExpandedArticle(article)}
                    >
                      <div className="flex items-center gap-2">
                        <ChevronRight className="w-4 h-4 flex-shrink-0" />
                        <div className="flex-1 truncate">
                          <p className="font-medium truncate">{article.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge 
                              variant="outline"
                              className={categoryColors[article.category]}
                            >
                              {categoryLabels[article.category]}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {article.helpful_count} útil
                            </span>
                          </div>
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-2">
        {expandedArticle ? (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{expandedArticle.title}</CardTitle>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge 
                      variant="outline"
                      className={categoryColors[expandedArticle.category]}
                    >
                      {categoryLabels[expandedArticle.category]}
                    </Badge>
                    {expandedArticle.tags.map((tag, index) => (
                      <Badge key={index} variant="outline" className="flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose max-w-none">
                <div dangerouslySetInnerHTML={{ __html: expandedArticle.content }} />
              </div>

              <Separator className="my-6" />

              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Este artigo foi útil?
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1"
                    onClick={() => {
                      // Implementar lógica de feedback
                    }}
                  >
                    <ThumbsUp className="w-4 h-4" />
                    Sim ({expandedArticle.helpful_count})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1"
                    onClick={() => {
                      // Implementar lógica de feedback
                    }}
                  >
                    <ThumbsDown className="w-4 h-4" />
                    Não ({expandedArticle.not_helpful_count})
                  </Button>
                </div>
              </div>

              {expandedArticle.related_articles?.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-3">Artigos Relacionados</h3>
                  <div className="space-y-2">
                    {articles
                      .filter(a => expandedArticle.related_articles.includes(a.id))
                      .map(article => (
                        <Button
                          key={article.id}
                          variant="ghost"
                          className="w-full justify-start text-left"
                          onClick={() => setExpandedArticle(article)}
                        >
                          <ChevronRight className="w-4 h-4 mr-2" />
                          {article.title}
                        </Button>
                      ))
                    }
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="flex items-center justify-center h-full min-h-[400px] rounded-lg border-2 border-dashed">
            <div className="text-center">
              <BookOpen className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">
                Selecione um artigo
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Escolha um artigo da lista para ver seu conteúdo completo
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}