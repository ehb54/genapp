#include "utility_routines.h"

QMap < QString, QString > UTILITY_JSON::split( QString qs )
{
   QMap < QString, QString > result;

   qs.stripWhiteSpace();
   // result[ "json_source" ] = qs;

   bool in_json = false;
   bool in_tok1 = false;
   bool in_tok2 = false;
   bool in_quote = false;
   int in_bracket = 0;
   bool in_brace = false;

   QString tok1;
   QString tok2;

   for ( unsigned i = 0; i < qs.length(); i++ )
   {
      QChar qc = qs.at( i );
      if ( qc == '{' && !in_json )
      {
         in_json = true;
         in_tok1 = true;
         continue;
      }
      
      if ( qc == '}' && in_json && !in_quote && !in_bracket && !in_brace )
      {
         result[ tok1 ] = tok2;
         tok1 = "";
         tok2 = "";
         in_json = false;
         in_tok1 = false;
         in_tok2 = false;
         break;
      }
      
      if ( qc == ':' && in_json && !in_quote && !in_bracket && !in_brace )
      {
         if ( !in_tok1 )
         {
            result[ "json parsing error" ] = "json error: unexpected ':'";
            return result;
         }
         in_tok1 = false;
         in_tok2 = true;
         continue;
      }

      if ( qc == '[' && in_json && !in_quote && in_tok2 /* && !in_bracket */ && !in_brace /* && !tok2.length() */ )
      {
         in_bracket++;
         if ( in_bracket > 1 )
         {
            tok2.append( qc );
            // result[ "json_last_token2" ] = tok2;
         }            
         continue;
      }

      if ( qc == ']' && in_json && !in_quote && in_tok2 && in_bracket && !in_brace )
      {
         in_bracket--;
         if ( in_bracket )
         {
            tok2.append( qc );
            // result[ "json_last_token2" ] = tok2;
         }            
         continue;
      }

      if ( qc == '{' && in_json && !in_quote && in_tok2 && !in_bracket && !in_brace && !tok2.length() )
      {
         in_brace = true;
         continue;
      }

      if ( qc == '}' && in_json && !in_quote && in_tok2 && in_brace && !in_bracket )
      {
         in_brace = false;
         continue;
      }
      
      if ( qc == ',' && in_json && !in_quote && !in_bracket && !in_brace )
      {
         if ( !in_tok2 )
         {
            result[ "json parsing error" ] = QString( "json error: unexpected ',' in_bracket %1" ).arg( in_bracket );
            return result;
         }
         result[ tok1 ] = tok2;
         tok1 = "";
         tok2 = "";
         in_tok1 = true;
         in_tok2 = false;
         continue;
      }
      
      if ( qc == '"' && in_json && !in_bracket && !in_brace )
      {
         if ( in_quote )
         {
            in_quote = false;
            continue;
         }
         if ( !in_quote )
         {
            in_quote = true;
            continue;
         }
      }
      
      if ( in_json )
      {
         if ( in_tok1 )
         {
            tok1.append( qc );
            // result[ "json_last_token1" ] = tok1;
            continue;
         }
         if ( in_tok2 )
         {
            tok2.append( qc );
            // result[ "json_last_token2" ] = tok2;
            continue;
         }
         result[ "json parsing error" ] = "json error: unexpected character";
         return result;
      }
   }
   return result;
}

QString UTILITY_JSON::compose( QMap < QString, QString > &mqq )
{
   QString result = "{";

   QRegExp rx_no_quotes( "^(\\d+|null|\\[.*\\]|\\{.*\\})$" );

   for ( QMap < QString, QString >::iterator it = mqq.begin();
         it != mqq.end();
         it++ )
   {

      result += 
         ( rx_no_quotes.search( it.key() ) != -1  ?
           it.key() :
           "\"" + it.key() + "\"" )
         + ":" +
         QString( rx_no_quotes.search( it.data() ) != -1  ?
                  it.data() :
                  "\"" + it.data() + "\"" 
                  ).replace( "\n", "\\r\\n" ) 
         + "," 
         ;
   }
   result.remove( result.length() - 1, 1 );
   result += "}";
   qDebug( "JSON:\n" + result );
   return result;
}

QValueVector < plotData > * UTILITY_JSON::array_string_to_qvv( const QString & s )
{
   QValueVector < plotData > * results = new QValueVector < plotData >;

   int      bracket_depth = 0;
   int      s_len = s.length();
   QString  x;
   QString  y;
   plotData pd;
   bool     in_x = true;

   for ( int i = 0; i < s_len; ++i )
   {
      QChar qc = s.at( i );
      if ( qc == '[' )
      {
         bracket_depth++;
         in_x = true;
         continue;
      }
      if ( qc == ']' )
      {
         if ( --bracket_depth )
         {
            pd.x.push_back( x.replace( "\"", "" ).toDouble() );
            pd.y.push_back( y.replace( "\"", "" ).toDouble() );
            // qDebug( QString( "pushing back %1 : %2" ).arg( x ).arg( y ) );
            x = "";
            y = "";
            in_x = true;
            continue;
         }
         (*results).push_back( pd );
         // qDebug( QString( "pushing vector" ) );
         pd.x.clear();
         pd.y.clear();
         in_x = true;
         continue;
      }
      if ( qc == ',' )
      {
         in_x = false;
         continue;
      }
      if ( in_x )
      {
         x.append( qc );
      } else {
         y.append( qc );
      }
   }
   return results;
}

QString UTILITY::unique_directory( const QString & basedir )
{
   QString uniqstr = QDateTime::currentDateTime().toString( "yyyyMMddhhmmsszzz" );
   QDir qd( basedir + QDir::separator() + uniqstr );
   if ( qd.exists() )
   {
      unsigned int ext = 1;
      do {
         qd.setPath( basedir + QDir::separator() + uniqstr + QString( "-%1" ).arg( ext++ ) );
      } while ( qd.exists() );
   }

   if ( !qd.mkdir( qd.path() ) )
   {
      // try to make parent
      if ( !qd.mkdir( QFileInfo( qd.path() ).dirPath() ) ) 
      {
         qDebug( QString( "UTILITY::unique_directory(): could not create the temporary directory '%1' nor it's parent. Check permissions\n" ).arg( qd.path() ) );
         return "";
      } else {
         if ( !qd.mkdir( qd.path() ) )
         {
            qDebug( QString( "UTILITY::unique_directory(): could not create the temporary directory '%1'. Check permissions\n" ).arg( qd.path() ) );
            return "";
         }
      }
   }

   if ( !qd.exists() )
   {
      qDebug( QString( "UTILITY::unique_directory(): directory '%1' does not exist after successful mkdir(). Check permissions\n" ).arg( qd.path() ) );
      return "";
   }

   if ( !qd.isReadable() )
   {
      qDebug( QString( "UTILITY::unique_directory(): directory '%1' exists but is not readable after successful mkdir(). Check permissions\n" ).arg( qd.path() ) );
      return "";
   }
   return qd.path();
}

